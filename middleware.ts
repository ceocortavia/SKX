import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const isPublicRoute = createRouteMatcher([
  "/api/healthz",
  "/api/health",
  "/",
  "/favicon.ico",
  "/robots.txt",
  "/sitemap.xml",
  "/sign-in(.*)",
  "/sign-up(.*)",
  "/api/brreg(.*)",
  "/api/profile/context",
  "/api/webhooks/clerk",
]);

const clerkMw = clerkMiddleware(async (auth, req) => {
  // Sikker test-bypass i prod med delt hemmelighet (kun ved eksplisitt header)
  const testSecret = req.headers.get('x-test-secret');
  if (testSecret && testSecret === process.env.TEST_SEED_SECRET) {
    return NextResponse.next();
  }

  // Check for test bypass ONLY in development mode
  const isDev = process.env.NODE_ENV !== "production";
  const testBypass = isDev && process.env.TEST_AUTH_BYPASS === "1";
  if (testBypass) {
    const testUserId = req.headers.get('x-test-clerk-user-id');
    const testEmail = req.headers.get('x-test-clerk-email');
    if (testUserId && testEmail) {
      return NextResponse.next();
    }
  }

  if (isPublicRoute(req)) return;
  // Tillat cron-endepunkt med delt hemmelighet
  if (req.nextUrl.pathname.startsWith('/api/tasks/enrich')) {
    const key = req.nextUrl.searchParams.get('key');
    if (key && key === process.env.CRON_ENRICH_SECRET) {
      return NextResponse.next();
    }
  }
  const { userId, redirectToSignIn } = await auth();
  if (!userId) return redirectToSignIn();
});

export default function middleware(req: NextRequest) {
  const p = req.nextUrl.pathname;
  // Early return helt utenfor Clerk for health/statikk
  if (p === '/api/healthz' || p === '/api/health' || p.startsWith('/_next') || p === '/favicon.ico') {
    return NextResponse.next({ headers: { 'Cache-Control': 'no-store' } });
  }
  // clerkMiddleware krever (req: NextRequest)
  // @ts-ignore – Clerk type overloads
  return clerkMw(req as any);
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};


