import { headers } from "next/headers";
import { auth, currentUser } from "@clerk/nextjs/server";

export async function getAuthContext(): Promise<{
  clerkUserId: string | null;
  email: string | null;
  mfaVerified: boolean;
}> {
  const h = headers();
  const testBypass = process.env.TEST_AUTH_BYPASS === "1";

  if (testBypass) {
    const testUserId = h.get("x-test-clerk-user-id");
    const testEmail = h.get("x-test-clerk-email");
    if (testUserId && testEmail) {
      return { clerkUserId: testUserId, email: testEmail, mfaVerified: true };
    }
  }

  const { userId: clerkUserId } = auth();
  if (!clerkUserId) return { clerkUserId: null, email: null, mfaVerified: false };

  const user = await currentUser();
  const email = user?.emailAddresses?.[0]?.emailAddress ?? null;
  return { clerkUserId, email, mfaVerified: false };
}


