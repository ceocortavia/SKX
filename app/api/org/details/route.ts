import { NextResponse } from "next/server";
import pool from "@/lib/db";
import { getAuthContext } from "@/lib/auth-context";
import { withGUC } from "@/lib/withGUC";

export const runtime = "nodejs";

export async function GET(req: Request) {
  try {
    const auth = await getAuthContext(req);
    if (!auth) return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });

    const url = new URL(req.url);
    const orgIdParam = url.searchParams.get("orgId");

    const client = await pool.connect();
    try {
      // Finn valgt orgId hvis ikke oppgitt
      let orgId: string | null = orgIdParam;

      if (!orgId) {
        const ures = await client.query<{ id: string }>(
          `select id from public.users where clerk_user_id=$1 limit 1`,
          [auth.clerkUserId]
        );
        const userUuid = ures.rows[0]?.id;
        if (!userUuid) return NextResponse.json({ ok: true, organization: null });

        const sel = await withGUC(client, { "request.user_id": userUuid }, async () => {
          const r = await client.query<{ id: string }>(
            `select o.id
             from public.user_org_selection uos
             join public.organizations o on o.id = uos.organization_id
             where uos.user_id = $1
             limit 1`,
            [userUuid]
          );
          return r.rows[0] ?? null;
        });
        orgId = sel?.id ?? null;
      }

      if (!orgId) return NextResponse.json({ ok: true, organization: null });

      // Hent membership for å sette RLS-kontekst korrekt (org_status må være 'approved')
      const ures2 = await client.query<{ id: string }>(
        `select id from public.users where clerk_user_id=$1 limit 1`,
        [auth.clerkUserId]
      );
      const userUuid = ures2.rows[0]?.id;
      if (!userUuid) return NextResponse.json({ ok: true, organization: null });

      const membership = await withGUC(client, { "request.user_id": userUuid, "request.org_id": orgId }, async () => {
        const r = await client.query<{ role: "owner" | "admin" | "member"; status: "approved" | "pending" }>(
          `select role, status from public.memberships where user_id=$1 and organization_id=$2 limit 1`,
          [userUuid, orgId]
        );
        return r.rows[0] ?? null;
      });

      const org = await withGUC(client, {
        "request.user_id": userUuid,
        "request.org_id": orgId,
        "request.org_status": membership?.status ?? null
      } as any, async () => {
        const r = await client.query(
          `select id, orgnr, name, org_form, registered_at, status_text, industry_code, address, ceo_name, revenue, raw_brreg_json
           from public.organizations where id = $1 limit 1`,
          [orgId]
        );
        return r.rows[0] ?? null;
      });

      return NextResponse.json({ ok: true, organization: org }, { headers: { "Cache-Control": "no-store" } });
    } finally {
      client.release();
    }
  } catch (err) {
    console.error("[org.details]", err);
    return NextResponse.json({ ok: false, error: "internal_error" }, { status: 500 });
  }
}


