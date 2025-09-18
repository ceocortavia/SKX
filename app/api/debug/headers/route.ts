import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const hs = req.headers;
  const testSecret = hs.get("x-test-secret") ?? "";
  const testUser = hs.get("x-test-clerk-user-id") ?? "";
  const testEmail = hs.get("x-test-clerk-email") ?? "";
  const haveEnv = !!process.env.TEST_SEED_SECRET;
  const match = haveEnv && testSecret === process.env.TEST_SEED_SECRET;
  return NextResponse.json({
    ok: true,
    received: {
      testSecret: testSecret ? true : false,
      testUser: testUser ? true : false,
      testEmail: testEmail ? true : false,
    },
    env: {
      haveTestSeedSecret: haveEnv,
    },
    match,
  });
}


