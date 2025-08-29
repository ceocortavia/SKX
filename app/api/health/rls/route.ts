import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  try {
    // Check for test bypass headers in development
    const testUserId = request.headers.get('x-test-clerk-user-id');
    const testEmail = request.headers.get('x-test-clerk-email');
    const isTestMode = process.env.TEST_AUTH_BYPASS === '1';
    
    if (isTestMode && testUserId && testEmail) {
      // Test mode with bypass headers
      return NextResponse.json({
        status: 'healthy',
        service: 'SKX RLS API',
        timestamp: new Date().toISOString(),
        environment: process.env.NODE_ENV || 'development',
        testMode: true,
        testUser: {
          id: testUserId,
          email: testEmail
        }
      }, { status: 200 });
    }
    
    // Normal mode - check if user is authenticated
    // For now, return 401 if no test bypass
    return NextResponse.json({
      status: 'unauthorized',
      message: 'Authentication required',
      note: 'Use test headers in development mode'
    }, { status: 401 });
    
  } catch (error) {
    return NextResponse.json({
      status: 'unhealthy',
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
