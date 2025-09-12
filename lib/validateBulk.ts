export const MAX_USER_IDS = 100;

export function validateUserIdsLimit(userIds: unknown):
  | { ok: true }
  | { ok: false; status: number; body: { ok: false; error: string; reason?: string; limit?: number; provided?: number } } {
  if (!Array.isArray(userIds) || userIds.length === 0) {
    return { ok: false, status: 400, body: { ok: false, error: "invalid_input" } };
  }
  if (userIds.length > MAX_USER_IDS) {
    return {
      ok: false,
      status: 400,
      body: {
        ok: false,
        error: "invalid_input",
        reason: "too_many_userIds",
        limit: MAX_USER_IDS,
        provided: userIds.length,
      },
    };
  }
  return { ok: true };
}

export function validateIdsLimit(ids: unknown):
  | { ok: true }
  | { ok: false; status: number; body: { ok: false; error: string; reason?: string; limit?: number; provided?: number } } {
  if (!Array.isArray(ids) || ids.length === 0) {
    return { ok: false, status: 400, body: { ok: false, error: "invalid_input" } };
  }
  if (ids.length > MAX_USER_IDS) {
    return {
      ok: false,
      status: 400,
      body: {
        ok: false,
        error: "invalid_input",
        reason: "too_many_ids",
        limit: MAX_USER_IDS,
        provided: ids.length,
      },
    };
  }
  return { ok: true };
}










