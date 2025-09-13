import { NextResponse } from "next/server";
import { auth, clerkClient } from "@clerk/nextjs/server";

export const runtime = "nodejs";

export async function POST() {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  const client = await clerkClient();
  const list = await client.sessions.getSessionList({ userId, status: "active", limit: 100 });
  const sessions = Array.isArray((list as any).data) ? (list as any).data : (list as any) || [];
  await Promise.all(
    sessions.map((s: any) => client.sessions.revokeSession(s.id).catch(() => undefined))
  );
  return NextResponse.json({ ok: true });
}


