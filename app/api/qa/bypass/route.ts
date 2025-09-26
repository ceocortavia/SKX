export const runtime = 'edge';
export const dynamic = 'force-dynamic';

export async function GET() {
  const enabled = process.env.ENABLE_QA_BYPASS === '1';
  if (!enabled) {
    return new Response('Not Found', { status: 404, headers: { 'cache-control': 'no-store' } });
  }
  return new Response(JSON.stringify({ enabled: true }), {
    status: 200,
    headers: { 'content-type': 'application/json', 'cache-control': 'no-store' }
  });
}


