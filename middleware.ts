<<<<<<< HEAD
// middleware.ts
import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";

const isDevOrBypass =
  process.env.NODE_ENV !== "production" ||
  process.env.TEST_AUTH_BYPASS === "1";

// Dev/bypass: la / og alle /api/* være åpne for lokal testing.
// Prod: kun /api/health/rls er offentlig.
const isPublicRoute = createRouteMatcher(
  isDevOrBypass
    ? ["/", "/api/(.*)", "/sign-in(.*)", "/sign-up(.*)"]
    : ["/api/health/rls", "/sign-in(.*)", "/sign-up(.*)"]
);

// ⬇️ Bruk redirectToSignIn i stedet for protect
=======
import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";

const isPublicRoute = createRouteMatcher([
  "/",
  "/favicon.ico",
  "/robots.txt",
  "/sitemap.xml",
  "/sign-in(.*)",
  "/sign-up(.*)",
]);

>>>>>>> origin/main
export default clerkMiddleware(async (auth, req) => {
  if (isPublicRoute(req)) return;
  const { userId, redirectToSignIn } = await auth();
  if (!userId) return redirectToSignIn();
});

export const config = {
  matcher: [
<<<<<<< HEAD
    // Skip Next internals/statics
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    // Kjør alltid på API
=======
    "/((?!_next|.*\\..*).*)",
>>>>>>> origin/main
    "/(api|trpc)(.*)",
  ],
};


