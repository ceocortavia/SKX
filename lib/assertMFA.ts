import { auth } from "@clerk/nextjs/server";

// Enkel, konservativ MFA-sjekk.
// Returnerer true hvis session har en nylig verifisert TOTP/passkey innen gitt vindu.
// Merk: Tilpass etter hvilke session-claims dere har aktivert i Clerk.
export async function assertMFA(maxAgeMinutes: number = 10): Promise<boolean> {
  // Test-bypass: i CI/dev kan vi tillate MFA som sann hvis bypass-headere brukes
  if (process.env.TEST_AUTH_BYPASS === "1") {
    return true;
  }
  const { sessionClaims } = auth();
  // Eksempel-claims: mfa_verified_at (epoch seconds) som du kan legge inn i Clerk JWT template
  const verifiedAt = (sessionClaims as any)?.mfa_verified_at as number | undefined;
  if (!verifiedAt) return false;
  const ageMs = Date.now() - verifiedAt * 1000;
  return ageMs <= maxAgeMinutes * 60_000;
}


