import { auth } from '@clerk/nextjs/server';

export interface AuthContext {
  clerkUserId: string;
  email: string;
  mfaVerified: boolean;
}

export async function getAuthContext(req: Request): Promise<AuthContext | null> {
  // Sikker test-bypass i prod med delt hemmelighet
  const testSecret = (req.headers.get('x-test-secret') || '').trim();
  const envSecret = (process.env.TEST_SEED_SECRET || '').trim();
  const secretMatches = !!testSecret && testSecret === envSecret;
  if (process.env.NODE_ENV === 'production') {
    try {
      // Ikke logg hemmeligheter, kun boolske indikatorer
      console.log('auth-context test-bypass', {
        provided: !!testSecret,
        match: secretMatches,
        haveEnv: !!process.env.TEST_SEED_SECRET,
      });
    } catch {}
  }
  if (secretMatches) {
    const testUserId = req.headers.get('x-test-clerk-user-id') || '';
    const testEmail = req.headers.get('x-test-clerk-email') || '';
    if (testUserId && testEmail) {
      return { clerkUserId: testUserId, email: testEmail, mfaVerified: true };
    }
  }

  // Check for test bypass ONLY in development mode
  const isDev = process.env.NODE_ENV !== "production";
  const testBypass = isDev && process.env.TEST_AUTH_BYPASS === "1";
  
  if (testBypass) {
    const testUserId = req.headers.get('x-test-clerk-user-id');
    const testEmail = req.headers.get('x-test-clerk-email');
    
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
    
    // For now, return basic info - email can be fetched separately if needed
    return {
      clerkUserId: userId,
      email: '', // Will be fetched from database
      mfaVerified: true // Assume MFA is verified for Clerk users
    };
  } catch (error) {
    console.error('Auth error:', error);
    return null;
  }
}
