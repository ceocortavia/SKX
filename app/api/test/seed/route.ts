export const runtime = "nodejs";

import { NextResponse } from "next/server";
import pool from "@/lib/db";
import { withGUC } from "@/lib/withGUC";

type SeedInput = {
  orgId?: string;
  invitations?: number;
  requestedRole?: "member" | "admin";
  emailPrefix?: string;
};

export async function POST(req: Request) {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });
  }
  const secret = req.headers.get("x-test-secret");
  const expected = process.env.TEST_SEED_SECRET;
  if (!expected || !secret || secret !== expected) {
    return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });
  }

  let raw = "";
  try { raw = await req.text(); } catch { return NextResponse.json({ ok: false, error: "invalid_json" }, { status: 400 }); }
  let body: SeedInput = {};
  try { body = raw ? JSON.parse(raw) : {}; } catch { return NextResponse.json({ ok: false, error: "invalid_json" }, { status: 400 }); }

  const orgId = body.orgId || process.env.NEXT_PUBLIC_TEST_ORG_ID || "";
  if (!orgId) return NextResponse.json({ ok: false, error: "missing_orgId" }, { status: 400 });

  const invitations = Math.max(0, Math.min(100, body.invitations ?? 0));
  const requestedRole = body.requestedRole ?? "member";
  const emailPrefix = body.emailPrefix ?? "invite+test";

  const client = await pool.connect();
  try {
    const createdInvitationIds: string[] = [];

    if (invitations > 0) {
      const rows = await withGUC(client, {
        "request.org_id": orgId,
        "request.org_role": "admin",
        "request.org_status": "approved",
        "request.mfa": "on",
      }, async () => {
        const ids: string[] = [];
        for (let i = 0; i < invitations; i++) {
          const email = `${emailPrefix}-${Math.random().toString(36).slice(2)}@example.com`;
          const res = await client.query(
            `insert into public.invitations (organization_id, email, requested_role, status, expires_at)
             values ($1::uuid, $2, $3::member_role, 'pending', now() + interval '7 days')
             returning id`,
            [orgId, email, requestedRole]
          );
          ids.push(res.rows[0].id);
        }
        return ids;
      });
      createdInvitationIds.push(...rows);
    }

    return NextResponse.json({ ok: true, orgId, invitationIds: createdInvitationIds });
  } finally {
    client.release();
  }
}









