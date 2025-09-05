export const runtime = "nodejs";

import { NextResponse } from "next/server";
import pool from "@/lib/db";

export async function POST(req: Request) {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });
  }
  const secret = req.headers.get("x-test-secret");
  const expected = process.env.TEST_SEED_SECRET;
  if (!expected || !secret || secret !== expected) {
    return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });
  }

  const client = await pool.connect();
  try {
    const runId = req.headers.get('x-test-run-id') || process.env.TEST_RUN_ID || '';
    if (runId) {
      await client.query(`delete from public.invitations where email like $1`, [`seed_${runId}_%@example.com`]);
    } else {
      await client.query(`delete from public.invitations where email like 'seed_%@example.com'`);
    }
    return NextResponse.json({ ok: true });
  } finally {
    client.release();
  }
}


