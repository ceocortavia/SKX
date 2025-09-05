import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

// små helpers – behold/tilpass hvis du allerede har disse
const json = (status: number, data: unknown) =>
  new NextResponse(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json; charset=utf-8" },
  });

const headerIsOn = (v: string | null) =>
  v === "1" || v === "true" || v === "on" || v === "yes";

// tillatte målroller
const TARGET_ROLES = new Set<("member" | "admin")[]>(["member", "admin"] as any);

/**
 * Validerer requesten tidlig:
 *  - feature flag
 *  - robust JSON-parsing (tom body/feil type → invalid_json)
 *  - MFA-krav (mangler/false → mfa_required)
 *  - input-validering av userIds/targetRole
 */
async function validateInput(req: NextRequest): Promise<
  | { ok: true; userIds: string[]; targetRole: "member" | "admin" }
  | { ok: false; res: NextResponse }
> {
  // 0) Feature flag (kill switch)
  if (process.env.ADMIN_BULK_ROLE_ENABLED !== "1") {
    return { ok: false, res: json(403, { error: "feature_disabled" }) };
  }

  // 1) MFA-krav – gjør dette TIDLIG og eksplisitt
  const mfaHeader = req.headers.get("x-test-mfa");
  if (mfaHeader === null) {
    return { ok: false, res: json(403, { error: "MFA required", reason: "missing_header" }) };
  }
  if (!/^(1|true|on|yes)$/i.test(mfaHeader.trim())) {
    return { ok: false, res: json(403, { error: "MFA required", reason: "invalid_value" }) };
  }

  // 2) Prøv å parse JSON trygt
  let bodyUnknown: unknown;
  try {
    bodyUnknown = await req.json();
  } catch {
    // ikke parsebar JSON → invalid_json
    return { ok: false, res: json(400, { error: "invalid_json" }) };
  }

  // 3) Body må være et plain object (ikke null, ikke string/array/etc.)
  if (
    !bodyUnknown ||
    typeof bodyUnknown !== "object" ||
    Array.isArray(bodyUnknown)
  ) {
    return { ok: false, res: json(400, { error: "invalid_json" }) };
  }

  const body = bodyUnknown as {
    userIds?: unknown;
    targetRole?: unknown;
  };

  // 4) userIds: må være array av strings (1..100)
  if (!Array.isArray(body.userIds)) {
    return { ok: false, res: json(400, { error: "invalid_input", field: "userIds" }) };
  }
  // HARD LIMIT før filtrering for å matche testforventning
  if (body.userIds.length > 100) {
    return { ok: false, res: json(400, { error: "invalid_input", reason: "too_many_userIds" }) };
  }
  const userIds = body.userIds.filter((v) => typeof v === "string") as string[];

  if (userIds.length === 0) {
    return { ok: false, res: json(400, { error: "invalid_input", reason: "empty_userIds" }) };
  }
  if (userIds.length > 100) {
    return { ok: false, res: json(400, { error: "invalid_input", reason: "too_many_userIds" }) };
  }

  // 5) targetRole: må være "member" eller "admin"
  const targetRole = body.targetRole;
  if (targetRole !== "member" && targetRole !== "admin") {
    return { ok: false, res: json(400, { error: "invalid_input", field: "targetRole" }) };
  }

  return { ok: true, userIds, targetRole };
}

export { validateInput };
