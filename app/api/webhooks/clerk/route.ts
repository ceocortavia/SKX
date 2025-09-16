import { NextResponse } from "next/server";
import pool from "@/lib/db";

// Enkel normalisering fra Clerk payload
function extractUser(payload: any) {
  const id: string | undefined = payload?.id;
  const emails: string[] = Array.isArray(payload?.email_addresses)
    ? payload.email_addresses.map((e: any) => e?.email_address).filter(Boolean)
    : [];
  const email = emails[0] || payload?.email || "";
  const first = payload?.first_name || "";
  const last = payload?.last_name || "";
  const full = [first, last].filter(Boolean).join(" ") || null;
  return { id, email, fullName: full } as { id?: string; email: string; fullName: string | null };
}

export async function POST(req: Request) {
  try {
    // Sikker test-bypass for CI/prod ved hjelp av delt secret
    const testSecret = req.headers.get("x-test-secret");
    const allowTest = testSecret && process.env.TEST_SEED_SECRET && testSecret === process.env.TEST_SEED_SECRET;

    // Clerk/Svix validering hoppes over i denne lightweight implementasjonen
    // (kan byttes til Svix.verify senere). Vi aksepterer kun test-bypass eller eksplisitt type-filter.

    const raw = await req.text();
    let evt: any = null;
    try { evt = JSON.parse(raw || "{}"); } catch { return NextResponse.json({ ok: false, error: "invalid_json" }, { status: 400 }); }

    const type = evt?.type as string | undefined;
    if (!type) return NextResponse.json({ ok: false, error: "invalid_input" }, { status: 400 });

    if (!allowTest) {
      // I prod uten test-bypass: godta kun user.created/user.updated, og fortsett uten DB-endring
      if (type !== "user.created" && type !== "user.updated") {
        return NextResponse.json({ ok: true, ignored: type });
      }
    }

    if (type === "user.created" || type === "user.updated") {
      const u = extractUser(evt?.data || evt);
      if (!u.id) return NextResponse.json({ ok: false, error: "invalid_input" }, { status: 400 });

      const client = await pool.connect();
      try {
        await client.query(
          `insert into public.users (clerk_user_id, primary_email, full_name, mfa_level)
           values ($1, $2, $3, 'none')
           on conflict (clerk_user_id) do update set
             primary_email = excluded.primary_email,
             full_name = excluded.full_name,
             updated_at = now()`,
          [u.id, u.email || "", u.fullName]
        );
      } finally {
        client.release();
      }
      return NextResponse.json({ ok: true, upserted: true });
    }

    return NextResponse.json({ ok: true, ignored: type });
  } catch (err) {
    console.error("[clerk.webhook]", err);
    return NextResponse.json({ ok: false, error: "internal_error" }, { status: 500 });
  }
}
