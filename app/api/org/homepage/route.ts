import { NextResponse } from "next/server";
import pool from "@/lib/db";
import { getAuthContext } from "@/lib/auth-context";
import { withGUC } from "@/lib/withGUC";
import { enrichOrganizationExternal } from "@/lib/enrichmentService";

export async function POST(req: Request) {
  try {
    const auth = await getAuthContext(req);
    if (!auth) return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });

    const body = await req.json().catch(() => ({} as any));
    const organizationId: string | undefined = body?.organization_id;
    const homepage: string | undefined = body?.homepage;
    if (!organizationId || !homepage) {
      return NextResponse.json({ ok: false, error: "invalid_input" }, { status: 400 });
    }

    const url = homepage.startsWith("http") ? homepage : `https://${homepage}`;
    let domain: string;
    try { domain = new URL(url).hostname; } catch { return NextResponse.json({ ok: false, error: "invalid_url" }, { status: 400 }); }

    const client = await pool.connect();
    try {
      // Finn intern user_id
      const u = await client.query<{ id: string }>(`select id from public.users where clerk_user_id=$1 limit 1`, [auth.clerkUserId]);
      const userId = u.rows[0]?.id;
      if (!userId) return NextResponse.json({ ok: false, error: "user_not_found" }, { status: 400 });

      // Sjekk rolle (owner/admin) + status for valgt org
      const roleRes = await withGUC(client, { "request.user_id": userId, "request.org_id": organizationId }, async () => {
        const r = await client.query<{ role: 'owner'|'admin'|'member'; status: 'approved'|'pending'|'blocked' }>(
          `select role, status from public.memberships where user_id=$1 and organization_id=$2 limit 1`,
          [userId, organizationId]
        );
        return r.rows[0] ?? null;
      });
      const role = roleRes?.role;
      const orgStatus = roleRes?.status;
      if (role !== 'owner' && role !== 'admin') {
        return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });
      }
      if (orgStatus !== 'approved') {
        return NextResponse.json({ ok: false, error: "org_not_approved" }, { status: 403 });
      }

      // Prevalider at domenet svarer (HEAD, fallback GET)
      try {
        const probe = await fetch(`https://${domain}`, { method: 'HEAD' });
        if (!probe.ok) {
          const getProbe = await fetch(`https://${domain}`, { method: 'GET' });
          if (!getProbe.ok) throw new Error('unreachable');
        }
      } catch {
        return NextResponse.json({ ok: false, error: "domain_unreachable" }, { status: 400 });
      }

      // RLS-sikkert oppdatering (krever org_role=admin/owner, org_status=approved, mfa=on)
      let updated: { orgnr: string | null } | null = null;
      try {
        updated = await withGUC(
          client,
          {
            "request.user_id": userId,
            "request.org_id": organizationId,
            "request.org_role": role,
            "request.org_status": orgStatus,
            "request.mfa": 'on',
          } as any,
          async () => {
            const r = await client.query<{ orgnr: string | null }>(
              `update public.organizations set homepage_domain=$1, updated_at=now() where id=$2 returning orgnr`,
              [domain, organizationId]
            );
            return r.rows[0] ?? null;
          }
        );
      } catch (e: any) {
        const msg = String(e?.message || e);
        if (msg.includes('row-level security') || msg.includes('RLS')) {
          return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });
        }
        throw e;
      }

      const orgnr = updated?.orgnr ?? null;
      if (orgnr) enrichOrganizationExternal(orgnr, client).catch(() => {});

      return NextResponse.json({ ok: true, homepage_domain: domain });
    } finally {
      client.release();
    }
  } catch (err) {
    console.error("[org.homepage]", err);
    return NextResponse.json({ ok: false, error: "internal_error" }, { status: 500 });
  }
}


