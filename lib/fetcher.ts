// lib/fetcher.ts
export type Json = unknown;

function devBypassHeaders(): HeadersInit | undefined {
  if (process.env.NEXT_PUBLIC_TEST_BYPASS !== "1") return undefined;
  const uid = process.env.NEXT_PUBLIC_DEV_BYPASS_USER_ID;
  const email = process.env.NEXT_PUBLIC_DEV_BYPASS_EMAIL;
  if (!uid || !email) return undefined;
  return {
    "x-test-clerk-user-id": uid,
    "x-test-clerk-email": email,
  };
}

export async function jsonFetcher<T = Json>(input: RequestInfo, init?: RequestInit): Promise<T> {
  const headers: HeadersInit = {
    ...(init?.headers || {}),
    ...(devBypassHeaders() || {}),
    "accept": "application/json",
  };
  const res = await fetch(input, { ...init, headers, credentials: "same-origin" });
  // If Clerk redirect page came back, try to surface meaningfully
  const ct = res.headers.get("content-type") || "";
  if (!res.ok) {
    let body: any = undefined;
    if (ct.includes("application/json")) body = await res.json().catch(() => undefined);
    else body = await res.text().catch(() => undefined);
    const msg = body?.error || body?.message || (typeof body === "string" ? body.slice(0, 200) : "Request failed");
    throw new Error(`${res.status} ${res.statusText} – ${msg}`);
  }
  if (ct.includes("application/json")) return res.json();
  // guard against HTML (Clerk sign-in) masquerading as success
  const text = await res.text();
  try { return JSON.parse(text); } catch {
    throw new Error("Expected JSON but received non-JSON (likely an auth redirect).");
  }
}


















