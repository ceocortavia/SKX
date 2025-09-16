import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

const isPublicRoute = createRouteMatcher([
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

export default clerkMiddleware(async (auth, req) => {
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
      // Allow test requests to pass through in dev mode only
      // This covers both API routes and protected pages
      return NextResponse.next();
    }
  }
  
  if (isPublicRoute(req)) return;
  const { userId, redirectToSignIn } = await auth();
  if (!userId) return redirectToSignIn();
});

export const config = {
  matcher: [
    "/((?!_next|.*\\..*).*)",
    "/(api|trpc)(.*)",
  ],
};


