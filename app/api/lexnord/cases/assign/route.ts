import { NextResponse } from "next/server";
import { z } from "zod";
import pool from "@/lib/db";
import { getAuthContext } from "@/lib/auth-context";
import { withGUC } from "@/lib/withGUC";
import { resolveLexNordContext, isLexNordAdmin } from "@/lib/lexnord";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const bodySchema = z.object({
  caseId: z.string().uuid(),
  assigneeUserId: z.string().uuid(),
});

export async function POST(req: Request) {
  let payload: unknown;
  try {
    payload = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "invalid_json" }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: "invalid_input" }, { status: 400 });
  }

  const { caseId, assigneeUserId } = parsed.data;

  try {
    const auth = await getAuthContext(req);
    if (!auth) {
      return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
    }

    const client = await pool.connect();
    try {
      const ctx = await resolveLexNordContext(client, auth.clerkUserId, req);
      if (!isLexNordAdmin(ctx)) {
        return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });
      }

      const updated = await withGUC(client, {
        "request.user_id": ctx.userId,
        "request.clerk_user_id": auth.clerkUserId,
        "request.org_id": ctx.orgId,
        "request.org_role": ctx.role,
        "request.org_status": ctx.status,
        "request.mfa": auth.mfaVerified ? "on" : "off",
      }, async () => {
        const caseRes = await client.query<{ id: string; status: string }>(
          `select id, status from public.cases where id = $1 and organization_id = $2 limit 1 for update`,
          [caseId, ctx.orgId]
        );
        if (!caseRes.rowCount) {
          return { ok: false as const, error: "not_found" as const };
        }
        const current = caseRes.rows[0];
        if (current.status !== 'pending_assignment') {
          return { ok: false as const, error: "invalid_status" as const };
        }

        const memberRes = await client.query<{ role: string }>(
          `select role
             from public.memberships
            where organization_id = $1 and user_id = $2 and status = 'approved'
            limit 1`,
          [ctx.orgId, assigneeUserId]
        );
        if (!memberRes.rowCount) {
          return { ok: false as const, error: "assignee_not_member" as const };
        }

        const result = await client.query(
          `update public.cases
              set assigned_user_id = $3,
                  status = 'awaiting_ocg',
                  metadata = metadata || jsonb_build_object(
                    'assignment', jsonb_build_object(
                      'assigned_at', to_jsonb(now()),
                      'assigned_by', to_jsonb($4::text)
                    )
                  ),
                  updated_at = now()
            where id = $1 and organization_id = $2
            returning id, title, client_name, status, assigned_user_id, metadata`,
          [caseId, ctx.orgId, assigneeUserId, ctx.userId]
        );

        const updatedCase = result.rows[0];
        await client.query(
          `insert into public.case_audit (case_id, action, actor_user_id, notes)
           values ($1, $2, $3, $4::jsonb)`,
          [
            caseId,
            'assign',
            ctx.userId,
            JSON.stringify({ assignee_user_id: assigneeUserId }),
          ]
        );

        return { ok: true as const, case: updatedCase };
      });

      if (!updated.ok) {
        const status = updated.error === 'not_found' ? 404 : 409;
        return NextResponse.json({ ok: false, error: updated.error }, { status });
      }

      return NextResponse.json({ ok: true, case: updated.case });
    } finally {
      client.release();
    }
  } catch (error: any) {
    const status = error?.status ?? 500;
    const message = status === 403 ? "forbidden" : "internal_error";
    if (status === 500) {
      console.error("[lexnord.assign]", error);
    }
    return NextResponse.json({ ok: false, error: message }, { status });
  }
}
