import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import pool from "@/lib/db";
import { getAuthContext } from "@/lib/auth-context";
import { withGUC } from "@/lib/withGUC";
import { clerkClient } from "@clerk/nextjs/server";
import type { AuthContext } from "@/lib/auth-context";

export async function POST(req: Request) {
  // Midlertidig bypass for test: hvis x-test-secret matcher, bruk headerverdier
  let auth: AuthContext | null = null;
  try {
    const secret = req.headers.get("x-test-secret");
    if (secret && secret === process.env.TEST_SEED_SECRET) {
      const uid = req.headers.get("x-test-clerk-user-id") || "";
      const email = req.headers.get("x-test-clerk-email") || "";
      if (uid && email) auth = { clerkUserId: uid, email, mfaVerified: true };
    }
  } catch {}
  if (!auth) auth = await getAuthContext(req);
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({} as any));
  const orgnr: string | undefined = body?.orgnr;
  const organizationIdInput: string | undefined = body?.organization_id;
  if (!organizationIdInput && !/^\d{9}$/.test(orgnr ?? "")) {
    return NextResponse.json({ ok: false, error: "invalid_input" }, { status: 400 });
  }
  const client = await pool.connect();
  try {
    let orgId: string | undefined = organizationIdInput;
    let existing: any = { rows: [] as any[] };

    if (!orgId && orgnr) {
      existing = await client.query(
        `select id, orgnr, name from public.organizations where orgnr=$1`,
        [orgnr]
      );
      orgId = existing.rows[0]?.id;
    }

    if (!orgId && orgnr) {
      const cache = await client.query(
        `select orgnr, name from public.brreg_cache where orgnr=$1`,
        [orgnr]
      );
      const name = cache.rows[0]?.name ?? `Org ${orgnr}`;
      const ins = await client.query(
        `insert into public.organizations (orgnr, name)
         values ($1,$2)
         on conflict (orgnr) do update set name=excluded.name
         returning id`,
        [orgnr, name]
      );
      orgId = ins.rows[0].id as string;
    }

    // Auto-upsert av bruker slik at valget alltid kan persisteres i DB
    let userId: string | undefined;
    {
      const r = await client.query<{ id: string }>(
        `select id from public.users where clerk_user_id=$1 limit 1`,
        [auth.clerkUserId]
      );
      userId = r.rows[0]?.id;
      if (!userId) {
        // Hent e-post fra Clerk hvis ikke tilgjengelig i auth-context
        let email = auth.email || "";
        if (!email) {
          try {
            const cc = await clerkClient();
            const u = await cc.users.getUser(auth.clerkUserId);
            email = u?.primaryEmailAddress?.emailAddress || u?.emailAddresses?.[0]?.emailAddress || "";
          } catch {}
        }
        const ins = await client.query<{ id: string }>(
          `insert into public.users (clerk_user_id, primary_email, full_name, mfa_level)
           values ($1, $2, null, 'none')
           on conflict (clerk_user_id) do update set clerk_user_id=excluded.clerk_user_id
           returning id`,
          [auth.clerkUserId, email || "unknown@local"]
        );
        userId = ins.rows[0]?.id;
      }
    }

    if (userId && orgId) {
      await withGUC(client, {
        "request.clerk_user_id": auth.clerkUserId,
        "request.user_id": userId,
        "request.org_id": orgId,
      }, async () => {
        const org = existing.rows[0] ?? { orgnr, name: undefined };
        await client.query(
          `insert into public.user_org_selection (user_id, organization_id, orgnr, org_name)
           values ($1,$2,$3,$4)
           on conflict (user_id) do update set
             organization_id=excluded.organization_id,
             orgnr=excluded.orgnr,
             org_name=excluded.org_name,
             updated_at=now()`,
          [userId, orgId, org.orgnr ?? orgnr, org.name ?? null]
        );

        // (Valgfritt) Opprett pending medlemskap hvis det ikke finnes
        const mem = await client.query(
          `select 1 from public.memberships where user_id=$1 and organization_id=$2 limit 1`,
          [userId, orgId]
        );
        if (!mem.rowCount) {
          await client.query(
            `insert into public.memberships (user_id, organization_id, role, status)
             values ($1,$2,'member','pending')`,
            [userId, orgId]
          );
        }
      });
    }

    const res = NextResponse.json({ ok: true, organization_id: orgId });
    res.cookies.set("orgId", orgId!, {
      path: "/",
      httpOnly: false,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      maxAge: 60 * 60 * 24 * 30,
    });
    return res;
  } catch (err) {
    console.error("[org.select]", err);
    return NextResponse.json({ ok: false, error: "internal_error" }, { status: 500 });
  } finally {
    client.release();
  }
}

export async function GET() {
  try {
    const jar = await cookies();
    const orgId = jar.get("orgId")?.value || null;
    return NextResponse.json({ organization_id: orgId });
  } catch (err) {
    return NextResponse.json({ organization_id: null });
  }
}


