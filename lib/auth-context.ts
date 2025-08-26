import { auth } from "@clerk/nextjs/server";

type AuthCtx = {
  clerkUserId?: string;
  email?: string;
  mfaVerified?: boolean;
};

export async function getAuthContext(req: Request): Promise<AuthCtx> {
  const h = req.headers;
  const testBypass = process.env.TEST_AUTH_BYPASS === "1";

  if (testBypass) {
    const testUserId = h.get("x-test-clerk-user-id");
    const testEmail = h.get("x-test-clerk-email");
    if (testUserId && testEmail) {
      return { clerkUserId: testUserId, email: testEmail, mfaVerified: true };
    }
  }

  try {
    const { userId, sessionClaims } = await auth();
    if (!userId) return {};
    const email = (sessionClaims as Record<string, unknown> | null)?.email as string | undefined;
    return { clerkUserId: userId, email, mfaVerified: false };
  } catch (e) {
    // Clerk auth() can throw if no valid session
    return {};
  }
}


