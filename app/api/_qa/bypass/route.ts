export const runtime = 'edge';
export const dynamic = 'force-dynamic';

export async function GET() {
  return new Response(
    JSON.stringify({ enabled: process.env.ENABLE_QA_BYPASS === '1' }),
    { status: 200, headers: { 'content-type': 'application/json', 'cache-control': 'no-store' } }
  );
}


