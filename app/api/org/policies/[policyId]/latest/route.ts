import { NextRequest, NextResponse } from "next/server";
import { db } from "@/server/db";
import { getSession, requireMember } from "@/server/authz";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest, context: { params: Promise<{ policyId: string }> }) {
  const { policyId } = await context.params;
  try {
    const session = await getSession(request);
    await requireMember(session.userId, session.orgId);

    const { rows } = await db.query(
      {
        text: `select pv.id,
                      pv.version,
                      p.title,
                      p.description,
                      pv.body_md
                 from public.policy_versions pv
                 join public.policies p on p.id = pv.policy_id
                where p.id = $1 and p.organization_id = $2
                order by pv.version desc
                limit 1`,
        values: [policyId, session.orgId],
      }
    );

    if (!rows.length) {
      return NextResponse.json({ error: "policy_not_found" }, { status: 404 });
    }

    return NextResponse.json(rows[0], { headers: { "Cache-Control": "no-store" } });
  } catch (error: any) {
    const status = error?.status ?? 500;
    if (status === 500) {
      console.error("[org.policy.latest]", error);
    }
    return NextResponse.json({ error: String(error?.message || error) }, { status });
  }
}
