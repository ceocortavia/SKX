import { auth } from "@clerk/nextjs/server";

// Enkel, konservativ MFA-sjekk.
// Returnerer true hvis session har en nylig verifisert TOTP/passkey innen gitt vindu.
// Merk: Tilpass etter hvilke session-claims dere har aktivert i Clerk.
export async function assertMFA(maxAgeMinutes: number = 10): Promise<boolean> {
  // Test-bypass: i CI/dev kan vi tillate MFA som sann hvis bypass-headere brukes
  if (process.env.TEST_AUTH_BYPASS === "1") return true;

  // Bruk server-API og await
  const { sessionClaims } = await auth();

  // Eksempel-claim fra Clerk JWT: mfa_verified_at (epoch seconds)
  const verifiedAt = (sessionClaims as Record<string, unknown> | null)?.[
    "mfa_verified_at"
  ] as number | undefined;

  if (!verifiedAt) return false;

  const ageSec = Math.floor(Date.now() / 1000) - verifiedAt;
  const windowSec = maxAgeMinutes * 60;
  return ageSec >= 0 && ageSec <= windowSec;
}


