import { NextResponse } from "next/server";
import { auth, clerkClient } from "@clerk/nextjs/server";

export const runtime = "nodejs";

export async function POST() {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  const client = await clerkClient();
  await client.users.revokeSessions(userId);
  return NextResponse.json({ ok: true });
}


