import { NextResponse } from "next/server";
import { z } from "zod";
import pool from "@/lib/db";
import { getAuthContext } from "@/lib/auth-context";
import { withGUC } from "@/lib/withGUC";
import { resolveLexNordContext, isLexNordAdmin } from "@/lib/lexnord";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const schema = z.object({
  caseId: z.string().uuid(),
  ocgData: z.record(z.unknown()).refine((val) => Object.keys(val).length > 0, { message: "empty_ocg" }),
});

export async function POST(req: Request) {
  let payload: unknown;
  try {
    payload = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "invalid_json" }, { status: 400 });
  }

  const parsed = schema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: "invalid_input" }, { status: 400 });
  }

  const { caseId, ocgData } = parsed.data;

  try {
    const auth = await getAuthContext(req);
    if (!auth) {
      return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
    }

    const client = await pool.connect();
    try {
      const ctx = await resolveLexNordContext(client, auth.clerkUserId, req);

      const result = await withGUC(client, {
        "request.user_id": ctx.userId,
        "request.clerk_user_id": auth.clerkUserId,
        "request.org_id": ctx.orgId,
        "request.org_role": ctx.role,
        "request.org_status": ctx.status,
        "request.mfa": auth.mfaVerified ? "on" : "off",
      }, async () => {
        const caseRes = await client.query<{
          id: string;
          status: string;
          assigned_user_id: string | null;
          metadata: any;
        }>(
          `select id, status, assigned_user_id, metadata
             from public.cases
            where id = $1 and organization_id = $2
            limit 1 for update`,
          [caseId, ctx.orgId]
        );
        if (!caseRes.rowCount) {
          return { ok: false as const, error: "not_found" as const };
        }
        const current = caseRes.rows[0];
        const isAssigned = current.assigned_user_id === ctx.userId;
        if (!isAssigned && !isLexNordAdmin(ctx)) {
          return { ok: false as const, error: "forbidden" as const };
        }
        if (current.status !== 'awaiting_ocg') {
          return { ok: false as const, error: "invalid_status" as const };
        }

        const updated = await client.query(
          `update public.cases
              set metadata = metadata || jsonb_build_object(
                    'ocg', $3::jsonb,
                    'ocg_timestamp', to_jsonb(now())
                  ),
                  status = 'awaiting_lockdown',
                  updated_at = now()
            where id = $1 and organization_id = $2
            returning id, title, client_name, status, assigned_user_id, metadata`,
          [caseId, ctx.orgId, JSON.stringify(ocgData)]
        );

        await client.query(
          `insert into public.case_audit (case_id, action, actor_user_id, notes)
           values ($1, 'ocg_submitted', $2, $3::jsonb)`,
          [caseId, ctx.userId, JSON.stringify({ ocg_keys: Object.keys(ocgData) })]
        );

        return { ok: true as const, case: updated.rows[0] };
      });

      if (!result.ok) {
        const mapStatus: Record<string, number> = {
          forbidden: 403,
          not_found: 404,
          invalid_status: 409,
        };
        const status = mapStatus[result.error] ?? 400;
        return NextResponse.json({ ok: false, error: result.error }, { status });
      }

      return NextResponse.json({ ok: true, case: result.case });
    } finally {
      client.release();
    }
  } catch (error: any) {
    const status = error?.status ?? 500;
    const message = status === 403 ? "forbidden" : "internal_error";
    if (status === 500) {
      console.error("[lexnord.ocg]", error);
    }
    return NextResponse.json({ ok: false, error: message }, { status });
  }
}

