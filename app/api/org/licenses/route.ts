import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/server/db";
import { getSession, requireApprovedAdmin, requireMember } from "@/server/authz";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const upsertSchema = z.object({
  targetUserId: z.string().uuid(),
  jurisdiction: z.string().min(2),
  licenseId: z.string().trim().optional(),
  expiresOn: z.string().optional(),
  status: z.string().optional(),
  docUrl: z.string().url().optional(),
});

function parseDate(value?: string | null) {
  if (!value) return null;
  if (!value.trim()) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return value;
}

export async function GET(request: Request) {
  try {
    const session = await getSession(request);
    await requireMember(session.userId, session.orgId);

    const url = new URL(request.url);
    const upcomingDays = parseInt(url.searchParams.get("upcoming_days") || "0", 10);

    const rows = await db.tx(async (client) => {
      const membershipRes = await client.query<{ role: string; status: string }>(
        `select role, status
           from public.memberships
          where user_id = $1 and organization_id = $2
          limit 1`,
        [session.userId, session.orgId]
      );
      const membership = membershipRes.rows[0];
      if (!membership) {
        throw new Error("membership_not_found");
      }

      await client.query(`select set_config('request.org_id', $1, true)`, [session.orgId]);
      await client.query(`select set_config('request.user_id', $1, true)`, [session.userId]);
      await client.query(`select set_config('request.org_role', $1, true)`, [membership.role]);
      await client.query(`select set_config('request.org_status', $1, true)`, [membership.status]);
      await client.query(`select set_config('request.mfa', $1, true)`, [session.mfaVerified ? 'on' : 'off']);

      const params: any[] = [session.orgId];
      let where = "organization_id = $1";
      if (Number.isFinite(upcomingDays) && upcomingDays > 0) {
        params.push(upcomingDays);
        where += ` AND expires_on IS NOT NULL AND expires_on <= (CURRENT_DATE + $${params.length}::int)`;
      }

      const result = await client.query(
        {
          text: `select id, user_id, jurisdiction, license_id, expires_on, status, doc_url, updated_at
                   from public.person_licenses
                  where ${where}
                  order by coalesce(expires_on, CURRENT_DATE + interval '10 years') asc`,
          values: params,
        }
      );

      return result.rows;
    });

    return NextResponse.json({ rows }, { headers: { "Cache-Control": "no-store" } });
  } catch (error: any) {
    const message = String(error?.message || error);
    const status = message === "membership_not_found" ? 403 : (error?.status ?? 500);
    if (status === 500) {
      console.error("[org.licenses.get]", error);
    }
    return NextResponse.json({ error: message }, { status });
  }
}

export async function POST(request: Request) {
  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const parsed = upsertSchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_input" }, { status: 400 });
  }

  try {
    const session = await getSession(request);
    await requireApprovedAdmin(session.userId, session.orgId);

  const { targetUserId, jurisdiction, licenseId, expiresOn, status, docUrl } = parsed.data;

    await db.tx(async (client) => {
      const membershipRes = await client.query<{ role: string; status: string }>(
        `select role, status
           from public.memberships
          where user_id = $1 and organization_id = $2
          limit 1`,
        [session.userId, session.orgId]
      );
      const membership = membershipRes.rows[0];
      if (!membership) {
        throw new Error("membership_not_found");
      }

      await client.query(`select set_config('request.org_id', $1, true)`, [session.orgId]);
      await client.query(`select set_config('request.user_id', $1, true)`, [session.userId]);
      await client.query(`select set_config('request.org_role', $1, true)`, [membership.role]);
      await client.query(`select set_config('request.org_status', $1, true)`, [membership.status]);
      await client.query(`select set_config('request.mfa', $1, true)`, [session.mfaVerified ? 'on' : 'off']);

      const existing = await client.query<{ id: string }>(
        `select id from public.person_licenses
          where organization_id = $1 and user_id = $2 and jurisdiction = $3
          limit 1`,
        [session.orgId, targetUserId, jurisdiction]
      );

      if (existing.rowCount) {
        await client.query(
          `update public.person_licenses
              set license_id = $2,
                  expires_on = $3,
                  status = coalesce($4, status),
                  doc_url = $5,
                  updated_at = now()
            where id = $1`,
          [
            existing.rows[0].id,
            licenseId ?? null,
            parseDate(expiresOn),
            status ?? null,
            docUrl ?? null,
          ]
        );
      } else {
        await client.query(
          `insert into public.person_licenses
             (organization_id, user_id, jurisdiction, license_id, expires_on, status, doc_url)
           values ($1, $2, $3, $4, $5, $6, $7)`,
          [
            session.orgId,
            targetUserId,
            jurisdiction,
            licenseId ?? null,
            parseDate(expiresOn) ?? null,
            status ?? "active",
            docUrl ?? null,
          ]
        );
      }
    });

    return NextResponse.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
  } catch (error: any) {
    const message = String(error?.message || error);
    const status = message === "membership_not_found" ? 403 : (error?.status ?? 500);
    if (status === 500) {
      console.error("[org.licenses.post]", error);
    }
    return NextResponse.json({ error: message }, { status });
  }
}
