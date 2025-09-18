import { NextResponse } from "next/server";
import pool from "@/lib/db";
import { withGUC } from "@/lib/withGUC";

export const runtime = "nodejs";

type Body = {
  clerk_user_id: string;
  organization_id: string;
  status?: "approved" | "pending";
};

export async function POST(req: Request) {
  // Ekstra sikkerhet: krev korrekt x-test-secret
  const secret = req.headers.get("x-test-secret");
  if (!secret || secret !== process.env.TEST_SEED_SECRET) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  let body: Body | null = null;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "invalid_json" }, { status: 400 });
  }

  const clerkUserId = body?.clerk_user_id;
  const orgId = body?.organization_id;
  const status = body?.status ?? "approved";
  if (!clerkUserId || !orgId) {
    return NextResponse.json({ ok: false, error: "invalid_input" }, { status: 400 });
  }

  const client = await pool.connect();
  try {
    const ures = await client.query<{ id: string }>(
      `select id from public.users where clerk_user_id=$1 limit 1`,
      [clerkUserId]
    );
    if (!ures.rowCount) {
      return NextResponse.json({ ok: false, error: "user_not_found" }, { status: 404 });
    }
    const userUuid = ures.rows[0].id;

    const updated = await withGUC(client, { "request.user_id": userUuid, "request.org_id": orgId }, async () => {
      const r = await client.query<{ role: string; status: string }>(
        `update public.memberships
         set status = $1
         where user_id = nullif(current_setting('request.user_id', true),'')::uuid
           and organization_id = nullif(current_setting('request.org_id', true),'')::uuid
         returning role, status`,
        [status]
      );
      return r.rows[0] ?? null;
    });

    if (!updated) {
      return NextResponse.json({ ok: false, error: "membership_not_found" }, { status: 404 });
    }

    return NextResponse.json({ ok: true, membership: updated });
  } catch (e) {
    return NextResponse.json({ ok: false, error: "internal_error" }, { status: 500 });
  } finally {
    client.release();
  }
}


