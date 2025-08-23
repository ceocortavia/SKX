import { auth } from "@clerk/nextjs/server";
import { headers as nextHeaders } from "next/headers";

type AuthCtx = {
  clerkUserId?: string;
  email?: string;
  mfaVerified?: boolean;
};

export async function getAuthContext(req?: Request): Promise<AuthCtx> {
  const h = req?.headers ?? nextHeaders();
  const testBypass = process.env.TEST_AUTH_BYPASS === "1";

  if (testBypass) {
    const testUserId = h.get("x-test-clerk-user-id");
    const testEmail = h.get("x-test-clerk-email");
    if (testUserId && testEmail) {
      return { clerkUserId: testUserId, email: testEmail, mfaVerified: true };
    }
  }

  const { userId, sessionClaims } = await auth();
  if (!userId) return {};
  const email = (sessionClaims as Record<string, unknown> | null)?.email as string | undefined;
  return { clerkUserId: userId, email, mfaVerified: false };
}


