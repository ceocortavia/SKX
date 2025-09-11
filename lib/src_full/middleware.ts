import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// Middleware for handling global errors and request logging
export function middleware(request: NextRequest) {
  try {
    // For API requests, ensure proper CORS handling
    if (request.nextUrl.pathname.startsWith('/api/')) {
      // Log API requests in development
      if (process.env.NODE_ENV === 'development') {
        console.log(`API Request: ${request.method} ${request.nextUrl.pathname}`);
      }

      // Handle preflight requests
      if (request.method === 'OPTIONS') {
        return new NextResponse(null, {
          status: 204,
          headers: {
            'Access-Control-Allow-Credentials': 'true',
            'Access-Control-Allow-Origin': '*', // In production, limit this
            'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type, Authorization',
            'Access-Control-Max-Age': '86400',
          },
        });
      }
    }

    // Path-specific handling
    if (request.nextUrl.pathname.startsWith('/api/auth/')) {
      // Add extra logging for auth routes
      console.log(`Auth route accessed: ${request.nextUrl.pathname}`);
      
      // Check for common auth header issues
      const authHeader = request.headers.get('authorization');
      if (authHeader?.startsWith('Bearer ') && authHeader.length < 10) {
        console.warn('Potentially invalid auth token detected');
      }
    }

    // Continue processing the request normally
    return NextResponse.next();
  } catch (error) {
    console.error('Middleware error:', error);
    
    // For API routes, return a JSON error
    if (request.nextUrl.pathname.startsWith('/api/')) {
      return NextResponse.json(
        { error: 'Internal server error in middleware' },
        { status: 500 }
      );
    }
    
    // For non-API routes, continue processing
    return NextResponse.next();
  }
}

// Configure which paths this middleware runs on
export const config = {
  matcher: [
    // Apply to all API routes
    '/api/:path*',
    // Apply to auth-related pages
    '/login',
    '/dashboard/:path*'
  ],
};