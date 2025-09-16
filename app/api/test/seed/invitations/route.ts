export const runtime = "nodejs";

import { NextResponse } from "next/server";
import pool from "@/lib/db";
import { withGUC } from "@/lib/withGUC";
import { z } from "zod";

const bodySchema = z.object({ count: z.number().int().min(1).max(10) });

export async function POST(req: Request) {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });
  }
  const orgId = req.headers.get('x-test-org-id') || req.headers.get('x-org-id') || process.env.NEXT_PUBLIC_TEST_ORG_ID || '';
  if (!orgId) return NextResponse.json({ ok: false, error: 'invalid_input', reason: 'missing_org' }, { status: 400 });

  let raw = "";
  try { raw = await req.text(); } catch { return NextResponse.json({ ok: false, error: 'invalid_json' }, { status: 400 }); }
  let body: z.infer<typeof bodySchema>;
  try { body = bodySchema.parse(raw ? JSON.parse(raw) : {}); } catch { return NextResponse.json({ ok: false, error: 'invalid_json' }, { status: 400 }); }

  const client = await pool.connect();
  try {
    // Sørg for at organisasjonen finnes (for testmiljøet kan vi opprette en minimal rad)
    await client.query(
      `insert into public.organizations (id, name)
       values ($1::uuid, 'TestOrg (seed)')
       on conflict (id) do nothing`,
      [orgId]
    );

    const runId = req.headers.get('x-test-run-id') || process.env.TEST_RUN_ID || 'local';
    const invitations = await withGUC(client, {
      "request.org_id": orgId,
      "request.org_role": "admin",
      "request.org_status": "approved",
      "request.mfa": "on",
    }, async () => {
      const created: { id: string; organization_id: string; email: string; status: string }[] = [];
      for (let i = 0; i < body.count; i++) {
        const email = `seed_${runId}_${Date.now()}_${Math.random().toString(36).slice(2)}@example.com`;
        const res = await client.query(
          `insert into public.invitations (organization_id, email, requested_role, status, expires_at)
           values ($1::uuid, $2, 'member'::member_role, 'pending', now() + interval '7 days')
           returning id, organization_id, email, status`,
          [orgId, email]
        );
        created.push(res.rows[0]);
      }
      return created;
    });

    return NextResponse.json({ ok: true, orgId, invitations }, { status: 200 });
  } finally {
    client.release();
  }
}


