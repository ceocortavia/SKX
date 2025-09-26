import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/server/db";
import { getSession, requireApprovedAdmin } from "@/server/authz";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const bodySchema = z.object({
  userId: z.string().uuid(),
});

export async function POST(request: NextRequest, context: { params: Promise<{ caseId: string }> }) {
  const { caseId } = await context.params;
  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json({ error: "user_id_required" }, { status: 422 });
  }

  try {
    const session = await getSession(request);
    await requireApprovedAdmin(session.userId, session.orgId);

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

      // Set request-scoped GUCs direkte i transaksjonen
      await client.query(`select set_config('request.org_id', $1, true)`, [session.orgId]);
      await client.query(`select set_config('request.user_id', $1, true)`, [session.userId]);
      await client.query(`select set_config('request.org_role', $1, true)`, [membership.role]);
      await client.query(`select set_config('request.org_status', $1, true)`, [membership.status]);
      await client.query(`select set_config('request.mfa', $1, true)`, [session.mfaVerified ? 'on' : 'off']);

      const caseRow = await client.query<{ id: string; status: string; assigned_user_id: string | null }>(
        `select id, status, assigned_user_id
           from public.cases
          where id = $1 and organization_id = $2
          limit 1 for update`,
        [caseId, session.orgId]
      );
      if (!caseRow.rowCount) {
        throw new Error("case_not_found");
      }
      const current = caseRow.rows[0];
      if (current.status !== "pending_assignment" && current.status !== "awaiting_ocg") {
        throw new Error("invalid_status");
      }

      const member = await client.query<{ role: string }>(
        `select role
           from public.memberships
          where organization_id = $1 and user_id = $2 and status = 'approved'
          limit 1`,
        [session.orgId, parsed.data.userId]
      );
      if (!member.rowCount) {
        throw new Error("assignee_not_member");
      }

      await client.query(
        `insert into public.case_assignments (organization_id, case_id, user_id)
         values ($1, $2, $3)
         on conflict (organization_id, case_id, user_id) do update
           set assigned_at = now()`,
        [session.orgId, caseId, parsed.data.userId]
      );

      await client.query(
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
          where id = $1 and organization_id = $2` ,
        [caseId, session.orgId, parsed.data.userId, session.userId]
      );

      const policies = await client.query<{ requirement_key: string; policy_version_id: string }>(
        `select case when p.key = 'OCG_GENERIC' then 'OCG_ACK' else 'INFO_WALL_ACK' end as requirement_key,
                pv.id as policy_version_id
           from public.policies p
           join public.policy_versions pv on pv.id = p.id
          where p.organization_id = $1
            and p.key in ('OCG_GENERIC','INFO_WALL')
            and pv.id = (
              select pv2.id
                from public.policy_versions pv2
               where pv2.policy_id = p.id
               order by pv2.version desc
               limit 1
            )`,
        [session.orgId]
      );

      for (const row of policies.rows) {
        await client.query(
          `insert into public.case_requirements (organization_id, case_id, requirement_key, policy_version_id)
           values ($1, $2, $3, $4)
           on conflict (organization_id, case_id, requirement_key, policy_version_id) do nothing`,
          [session.orgId, caseId, row.requirement_key, row.policy_version_id]
        );
      }

      await client.query(
        `insert into public.case_audit (case_id, action, actor_user_id, notes)
         values ($1, 'assign', $2, $3::jsonb)` ,
        [caseId, session.userId, JSON.stringify({ assignee_user_id: parsed.data.userId })]
      );

      const pending = await client.query(
        `select cr.requirement_key,
                cr.policy_version_id,
                pv.version,
                pol.title,
                (select primary_email from public.users where id = $2 limit 1) as assignee_email
           from public.case_requirements cr
           join public.policy_versions pv on pv.id = cr.policy_version_id
           join public.policies pol on pol.id = pv.policy_id
           left join public.policy_ack pa on pa.organization_id = cr.organization_id
                                        and pa.user_id = $2
                                        and pa.policy_version_id = cr.policy_version_id
          where cr.organization_id = $1
            and cr.case_id = $3
            and pa.id is null`,
        [session.orgId, parsed.data.userId, caseId]
      );

      return {
        ok: true,
        pending: pending.rows,
      };
    });

    return NextResponse.json(result, { headers: { "Cache-Control": "no-store" } });
  } catch (error: any) {
    const message = String(error?.message || error);
    const statusMap: Record<string, number> = {
      unauthorized: 401,
      no_org: 403,
      org_not_approved: 403,
      case_not_found: 404,
      assignee_not_member: 404,
      invalid_status: 409,
      membership_not_found: 403,
    };
    const status = statusMap[message] ?? (error?.status ?? 500);
    if (status === 500) {
      console.error("[org.case.assign]", error);
    }
    return NextResponse.json({ error: message }, { status });
  }
}
