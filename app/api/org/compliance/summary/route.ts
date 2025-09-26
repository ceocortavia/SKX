import { NextResponse } from "next/server";
import { db } from "@/server/db";
import { getSession, requireMember } from "@/server/authz";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const session = await getSession(request);
    await requireMember(session.userId, session.orgId);

    const url = new URL(request.url);
    const caseId = url.searchParams.get("caseId");
    const mine = url.searchParams.get("mine") === "1";
    const userIdParam = url.searchParams.get("userId");

    const targetUserId = mine ? session.userId : userIdParam ?? undefined;

    const { aggRows, detailRows } = await db.tx(async (client) => {
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

      // Set request-scoped GUCs for RLS within this transaction
      await client.query(`select set_config('request.org_id', $1, true)`, [session.orgId]);
      await client.query(`select set_config('request.user_id', $1, true)`, [session.userId]);
      await client.query(`select set_config('request.org_role', $1, true)`, [membership.role]);
      await client.query(`select set_config('request.org_status', $1, true)`, [membership.status]);
      await client.query(`select set_config('request.mfa', $1, true)`, [session.mfaVerified ? 'on' : 'off']);

      const params: any[] = [session.orgId];
      let where = "ca.organization_id = $1";
      if (caseId) {
        params.push(caseId);
        where += ` AND ca.case_id = $${params.length}`;
      }
      if (targetUserId) {
        params.push(targetUserId);
        where += ` AND ca.user_id = $${params.length}`;
      }

      const aggResult = await client.query(
        {
          text: `select ca.user_id,
                        ca.case_id,
                        count(cr.id) as total_req,
                        count(pa.id) as acked,
                        sum(case when cr.requirement_key = 'OCG_ACK' then 1 else 0 end) as total_ocg,
                        sum(case when cr.requirement_key = 'OCG_ACK' and pa.id is not null then 1 else 0 end) as acked_ocg,
                        sum(case when cr.requirement_key = 'INFO_WALL_ACK' then 1 else 0 end) as total_info,
                        sum(case when cr.requirement_key = 'INFO_WALL_ACK' and pa.id is not null then 1 else 0 end) as acked_info
                   from public.case_assignments ca
                   join public.case_requirements cr on cr.organization_id = ca.organization_id
                                                 and cr.case_id = ca.case_id
                   left join public.policy_ack pa on pa.organization_id = cr.organization_id
                                                and pa.user_id = ca.user_id
                                                and pa.policy_version_id = cr.policy_version_id
                  where ${where}
                  group by ca.user_id, ca.case_id
                  order by ca.case_id, ca.user_id`,
          values: params,
        }
      );

      let details: any[] = [];
      if (caseId && targetUserId) {
        const detailRes = await client.query(
          {
            text: `select cr.requirement_key,
                          cr.policy_version_id,
                          pv.version,
                          pol.title,
                          pol.id as policy_id,
                          (pa.id is not null) as is_acked
                     from public.case_requirements cr
                     join public.policy_versions pv on pv.id = cr.policy_version_id
                     join public.policies pol on pol.id = pv.policy_id
                left join public.policy_ack pa on pa.organization_id = cr.organization_id
                                               and pa.user_id = $1
                                               and pa.policy_version_id = cr.policy_version_id
                    where cr.organization_id = $2
                      and cr.case_id = $3
                    order by pol.title`,
            values: [targetUserId, session.orgId, caseId],
          }
        );
        details = detailRes.rows;
      }

      return { aggRows: aggResult.rows, detailRows: details };
    });

    const summarizeStatus = (row: {
      total_req: number;
      acked: number;
      total_ocg: number;
      acked_ocg: number;
      total_info: number;
      acked_info: number;
    }) => {
      if (row.total_req === 0 || row.acked >= row.total_req) return "ready";
      if (row.total_ocg > row.acked_ocg) return "awaiting_ocg";
      if (row.total_info > row.acked_info) return "awaiting_lockdown";
      return "pending";
    };

    const toNumber = (value: unknown) => Number(value ?? 0);

    const aggWithStatus = aggRows.map((row: any) => {
      const base = {
        user_id: row.user_id as string,
        case_id: row.case_id as string,
        total_req: toNumber(row.total_req),
        acked: toNumber(row.acked),
        total_ocg: toNumber(row.total_ocg),
        acked_ocg: toNumber(row.acked_ocg),
        total_info: toNumber(row.total_info),
        acked_info: toNumber(row.acked_info),
      };

      return {
        ...base,
        status: summarizeStatus(base),
      };
    });

    let summaryStatus: string | undefined;
    if (caseId && targetUserId) {
      const match = aggWithStatus.find(
        (row) => row.case_id === caseId && row.user_id === targetUserId
      );
      if (match) {
        summaryStatus = match.status;
      } else if (detailRows.length) {
        const hasOcg = detailRows.some((d) => d.requirement_key === "OCG_ACK" && !d.is_acked);
        const hasInfo = detailRows.some((d) => d.requirement_key === "INFO_WALL_ACK" && !d.is_acked);
        if (!hasOcg && !hasInfo) summaryStatus = "ready";
        else if (hasOcg) summaryStatus = "awaiting_ocg";
        else if (hasInfo) summaryStatus = "awaiting_lockdown";
        else summaryStatus = "pending";
      }
    }

    return NextResponse.json(
      { agg: aggWithStatus, details: detailRows, status: summaryStatus },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (error: any) {
    const message = String(error?.message || error);
    const status = message === "membership_not_found" ? 403 : (error?.status ?? 500);
    if (status === 500) {
      console.error("[org.compliance.summary]", error);
    }
    return NextResponse.json({ error: message }, { status });
  }
}
