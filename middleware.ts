import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";

const devBypass = process.env.NODE_ENV !== "production" || process.env.TEST_AUTH_BYPASS === "1";
const isPublicRoute = createRouteMatcher(
  devBypass
    ? [
        "/",
        "/favicon.ico",
        "/robots.txt",
        "/sitemap.xml",
        "/sign-in(.*)",
        "/sign-up(.*)",
        "/api/(.*)",
        "/api/_health/rls",
      ]
    : [
        "/",
        "/favicon.ico",
        "/robots.txt",
        "/sitemap.xml",
        "/sign-in(.*)",
        "/sign-up(.*)",
        "/api/_health/rls",
      ]
);

export default clerkMiddleware(async (auth, req) => {
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


