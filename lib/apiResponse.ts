export type ErrorCode =
  | "invalid_json"
  | "invalid_input"
  | "unauthorized"
  | "forbidden"
  | "feature_disabled"
  | "not_found"
  | "rate_limited"
  | "conflict";

export function ok<T>(data: T, init: number = 200) {
  return Response.json({ ok: true, data }, { status: init });
}

export function fail(
  error: ErrorCode,
  reason?: string,
  init: number = 400,
  extra?: Record<string, unknown>
) {
  return Response.json({ ok: false, error, reason, ...(extra || {}) }, { status: init });
}




