import { auth, currentUser } from '@clerk/nextjs/server';
import { headers as nextHeaders } from 'next/headers';
import pool from '@/lib/db';

export interface AuthContext {
  clerkUserId: string;
  email: string;
  mfaVerified: boolean;
}

export async function getAuthContext(req: Request): Promise<AuthContext | null> {
  const hdrs = req?.headers ?? (nextHeaders() as any);
  const header = (name: string) => (hdrs.get ? hdrs.get(name) : hdrs.get(name));

  // QA-bypass før Clerk
  const enableQa = process.env.ENABLE_QA_BYPASS === '1';
  const bypassSecret = (process.env.TEST_BYPASS_SECRET || process.env.TEST_SEED_SECRET || '').trim();
  const hasBypass = enableQa && (header('x-test-bypass') === '1') && !!bypassSecret && (header('x-test-secret') === bypassSecret);
  if (hasBypass) {
    const clerkUserId = header('x-test-clerk-user-id') || 'test_user';
    const email = header('x-test-clerk-email') || 'qa@test.local';
    // Valgfritt: upsert QA-bruker i users
    if (process.env.TEST_BYPASS_UPSERT === '1') {
      try {
        const client = await pool.connect();
        try {
          await client.query(
            `insert into public.users (clerk_user_id, primary_email, full_name)
             values ($1,$2,$3)
             on conflict (clerk_user_id) do nothing`,
            [clerkUserId, email, 'QA User']
          );
        } finally {
          client.release();
        }
      } catch {}
    }
    return { clerkUserId, email, mfaVerified: true };
  }

  // Check for test bypass ONLY in development mode
  const isDev = process.env.NODE_ENV !== "production";
  const testBypass = isDev && process.env.TEST_AUTH_BYPASS === "1";
  
  if (testBypass) {
    const testUserId = header('x-test-clerk-user-id');
    const testEmail = header('x-test-clerk-email');
    
    if (testUserId && testEmail) {
      // Simulate MFA verification in dev mode
      return {
        clerkUserId: testUserId,
        email: testEmail,
        mfaVerified: true
      };
    }
  }
  
  // Normal Clerk authentication
  try {
    const { userId } = await auth();
    if (!userId) return null;
    const u = await currentUser();
    return {
      clerkUserId: userId,
      email: u?.emailAddresses?.[0]?.emailAddress || '',
      mfaVerified: true,
    };
  } catch (error) {
    console.error('Auth error:', error);
    return null;
  }
}
