// middleware.ts
import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";

const isPublic = createRouteMatcher([
  "/",                // landing
  "/sign-in(.*)",     // auth pages
  "/sign-up(.*)",
  "/api/health/(.*)", // public health endpoints
]);

export default clerkMiddleware(async (auth, req) => {
  // Dev-only API bypass (optional). Never active in prod.
  if (process.env.NODE_ENV !== "production" && process.env.TEST_AUTH_BYPASS === "1") {
    const hasBypass =
      req.headers.get("x-test-clerk-user-id") &&
      req.headers.get("x-test-clerk-email");
    if (hasBypass && req.nextUrl.pathname.startsWith("/api/")) return;
  }

  if (isPublic(req)) return;

  // v5 requires awaiting the promise:
  const { userId, redirectToSignIn } = await auth();
  if (!userId) return redirectToSignIn();
});

export const config = {
  // Match all app routes & API routes; exclude static assets and Next internals
  matcher: [
    "/((?!.+\\.[\\w]+$|_next|favicon\\.ico|robots\\.txt).*)",
    "/",
    "/(api|trpc)(.*)",
  ],
};


