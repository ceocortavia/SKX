import { clerkMiddleware } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const clerkMw = clerkMiddleware(async (auth, req) => {
  const { userId, redirectToSignIn } = await auth();
  if (!userId) return redirectToSignIn();
});

export default function middleware(req: NextRequest) {
  const p = req.nextUrl.pathname;

  // 0) Diagnose & health – slipp alltid gjennom FØR Clerk
  if (p.startsWith('/api/_qa/') || p.startsWith('/api/qa/')) {
    if (process.env.ENABLE_QA_BYPASS !== '1') {
      return new Response('Not Found', { status: 404 });
    }
    return NextResponse.next({ headers: { 'Cache-Control': 'no-store' } });
  }
  if (p.startsWith('/api/_diag/')) {
    return NextResponse.next({ headers: { 'Cache-Control': 'no-store' } });
  }
  if (p === '/api/healthz' || p === '/api/health') {
    return NextResponse.next({ headers: { 'Cache-Control': 'no-store' } });
  }

  // 1) QA-bypass for API-ruter (kun når flagget er på)
  if (process.env.ENABLE_QA_BYPASS === '1') {
    const secret = process.env.TEST_BYPASS_SECRET || process.env.TEST_SEED_SECRET;
    const wantsBypass = req.headers.get('x-test-bypass') === '1';
    const hdr = req.headers.get('x-test-secret');
    if (secret && hdr === secret && wantsBypass && p.startsWith('/api/')) {
      const h = new Headers(req.headers);
      h.set('x-test-bypass', '1');
      return NextResponse.next({ request: { headers: h }, headers: { 'Cache-Control': 'no-store' } });
    }
  }

  // 2) Ellers: Clerk beskytter API
  // @ts-ignore Clerk expects NextRequest
  return clerkMw(req as any);
}

// ✅ Kun API/TRPC – vi rører ikke siderute-auth
export const config = {
  matcher: ['/api/:path*', '/trpc/:path*'],
};


