import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/server/db";
import { getSession, requireMember } from "@/server/authz";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const schema = z.object({
  context: z.record(z.any()).optional(),
});

export async function POST(request: NextRequest, context: { params: Promise<{ policyId: string }> }) {
  const { policyId } = await context.params;
  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    payload = {};
  }

  const parsed = schema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_input" }, { status: 400 });
  }

  try {
    const session = await getSession(request);
    await requireMember(session.userId, session.orgId);

    const result = await db.tx(async (client) => {
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

      // Set request-scoped GUCs for RLS
      await client.query(`select set_config('request.org_id', $1, true)`, [session.orgId]);
      await client.query(`select set_config('request.user_id', $1, true)`, [session.userId]);
      await client.query(`select set_config('request.org_role', $1, true)`, [membership.role]);
      await client.query(`select set_config('request.org_status', $1, true)`, [membership.status]);
      await client.query(`select set_config('request.mfa', $1, true)`, [session.mfaVerified ? 'on' : 'off']);

      const versionRes = await client.query<{ policy_version_id: string }>(
        `select pv.id as policy_version_id
           from public.policy_versions pv
           join public.policies p on p.id = pv.policy_id
          where p.id = $1 and p.organization_id = $2
          order by pv.version desc
          limit 1`,
        [policyId, session.orgId]
      );
      if (!versionRes.rowCount) {
        throw new Error("policy_not_found");
      }

      const versionId = versionRes.rows[0].policy_version_id;

      await client.query(
        `insert into public.policy_ack (organization_id, user_id, policy_version_id, context)
         values ($1, $2, $3, $4::jsonb)
         on conflict (organization_id, user_id, policy_version_id) do nothing`,
        [session.orgId, session.userId, versionId, JSON.stringify(parsed.data.context ?? null)]
      );

      return { ok: true, policy_version_id: versionId };
    });

    return NextResponse.json(result, { headers: { "Cache-Control": "no-store" } });
  } catch (error: any) {
    const message = String(error?.message || error);
    const status = message === "policy_not_found"
      ? 404
      : message === "membership_not_found"
        ? 403
        : (error?.status ?? 500);
    if (status === 500) {
      console.error("[org.policy.ack]", error);
    }
    return NextResponse.json({ error: message }, { status });
  }
}
