import { NextRequest, NextResponse } from "next/server";
import pool from "@/lib/db";
import { getAuthContext } from "@/lib/auth-context";
import { withGUC } from "@/lib/withGUC";
import { enrichOrganizationExternal } from "@/lib/enrichmentService";
import { requireApprovedAdmin, requireMember, getSession } from "../../../../server/authz";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function normalizeDomain(input: string): string | null {
  try {
    if (!input) return null;
    let s = input.trim();
    if (!/^https?:\/\//i.test(s)) s = "https://" + s;
    const u = new URL(s);
    const host = (u.hostname || "").toLowerCase();
    if (!host || host === "localhost") return null;
    return host;
  } catch {
    return null;
  }
}

async function pingHead(url: string, timeoutMs = 4000): Promise<boolean> {
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), timeoutMs);
    const res = await fetch(url, { method: "HEAD", signal: ctrl.signal });
    clearTimeout(t);
    return res.ok || (res.status >= 200 && res.status < 500);
  } catch {
    return false;
  }
}

export async function GET(req: NextRequest) {
  const { orgId, userId } = await getSession(req as any);
  await requireMember(userId, orgId);

  const client = await pool.connect();
  try {
    const r = await client.query(
      `select id, name as display_name, homepage_domain, tech_stack, tech_stack_updated_at, tech_stack_source from public.organizations where id=$1 limit 1`,
      [orgId]
    );
    if (!r.rowCount) return NextResponse.json({ error: "org_not_found" }, { status: 404 });
    return NextResponse.json(r.rows[0], { headers: { "Cache-Control": "no-store" } });
  } finally {
    client.release();
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getSession(req as any);

    const body = await req.json().catch(() => ({} as any));
    const homepage: string | undefined = (body?.homepage || body?.url || body?.domain) as string | undefined;
    if (!homepage) return NextResponse.json({ ok: false, error: "invalid_input" }, { status: 400 });

    const domain = normalizeDomain(homepage);
    if (!domain) return NextResponse.json({ ok: false, error: "invalid_domain" }, { status: 422 });

    const client = await pool.connect();
    try {
      await requireApprovedAdmin(session.userId, session.orgId);

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
            "request.user_id": session.userId,
            "request.org_id": session.orgId,
            "request.org_role": 'admin',
            "request.org_status": 'approved',
            "request.mfa": 'on',
          } as any,
          async () => {
            const r = await client.query<{ orgnr: string | null }>(
              `update public.organizations set homepage_domain=$1, updated_at=now() where id=$2 returning orgnr`,
              [domain, session.orgId]
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


