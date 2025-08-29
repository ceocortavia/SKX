import { expect, APIResponse } from "@playwright/test";

/**
 * Godtar følgende som "beskyttet":
 *  - 401 Unauthorized
 *  - 3xx redirect
 *  - Eller at slutt-URL (etter ev. redirect) peker til Clerk /sign-in
 */
export async function expectProtected(res: APIResponse) {
  const status = res.status();
  const url = res.url();

  // 401 = ok (API responderer med unauthorized)
  if (status === 401) {
    expect(status, "expected 401 Unauthorized").toBe(401);
    return;
  }

  // 3xx redirect = ok (browser-stil redirect)
  if ([301, 302, 303, 307, 308].includes(status)) {
    expect(status, "expected 3xx redirect").toBeGreaterThanOrEqual(300);
    expect(status).toBeLessThan(400);
    return;
  }

  // Dersom Playwright følger redirecten og vi havner på login
  // får vi typisk 200 men på /sign-in. Godta det også.
  if (status === 200 && /\/sign-in/i.test(url)) {
    expect(url, "expected to end on /sign-in").toMatch(/\/sign-in/i);
    return;
  }

  // Som ekstra fallback: HTML-kropp som inneholder "Sign in"
  const ct = res.headers()["content-type"] ?? "";
  if (status === 200 && ct.includes("text/html")) {
    const body = await res.text();
    if (/sign in|logg inn/i.test(body)) return;
  }

  // Hvis ingen av disse traff: feile eksplisitt med god feilmelding
  throw new Error(
    `Expected protected response (401/3xx or /sign-in), got ${status} at ${url}`
  );
}
