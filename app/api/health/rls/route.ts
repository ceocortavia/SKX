import { NextResponse } from "next/server";
import { getAuthContext } from "@/lib/auth-context";
import { pool } from "@/lib/db";
import { withGUC } from "@/lib/withGUC";

export const runtime = "nodejs";

export async function GET(req: Request) {
  try {
    const { clerkUserId, email, mfaVerified } = await getAuthContext(req);
    
    // Test database connection
    const client = await pool.connect();
    try {
      // Get policy snapshot
      const policiesRes = await client.query(
        `select tablename, policyname, cmd, coalesce(qual::text,'') as qual, coalesce(with_check::text,'') as with_check
         from pg_policies where schemaname='public'
         order by tablename, policyname`
      );

      // Sanity check: anonymous RLS (under app_client role, no GUCs)
      const anonRlsUsers = await withGUC(
        { userId: undefined, orgId: undefined, orgRole: undefined, orgStatus: undefined, mfa: "off" },
        async (tx) => {
          const res = await tx.query(`select count(*) from public.users`);
          return parseInt(res.rows[0].count, 10);
        }
      );

      const anonRlsOrgs = await withGUC(
        { userId: undefined, orgId: undefined, orgRole: undefined, orgStatus: undefined, mfa: "off" },
        async (tx) => {
          const res = await tx.query(`select count(*) from public.organizations`);
          return parseInt(res.rows[0].count, 10);
        }
      );

      return NextResponse.json({
        ok: true,
        auth: {
          clerkUserId: clerkUserId ? 'authenticated' : 'anonymous',
          email: email ? 'set' : 'not_set',
          mfaVerified: mfaVerified || false,
        },
        rls: {
          anonUsers: anonRlsUsers,
          anonOrgs: anonRlsOrgs,
          policies: policiesRes.rows.length,
        },
        policies: policiesRes.rows,
        timestamp: new Date().toISOString(),
      });
    } finally {
      client.release();
    }
  } catch (e: any) {
    console.error("Health check failed:", e);
    return NextResponse.json({ 
      ok: false, 
      error: e.message || "Unknown error",
      timestamp: new Date().toISOString(),
    }, { status: 500 });
  }
}


