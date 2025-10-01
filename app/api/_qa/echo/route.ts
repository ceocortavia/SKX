export const runtime = 'edge';
export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const h = req.headers;
  const out = {
    enabled: process.env.ENABLE_QA_BYPASS === '1',
    hasSecretHeader: Boolean(h.get('x-test-secret')),
    bypassHeader: h.get('x-test-bypass') === '1',
    role: h.get('x-test-role') || null,
    orgId: h.get('x-test-org-id') || null,
  };
  return new Response(JSON.stringify(out), {
    status: 200,
    headers: { 'content-type': 'application/json', 'cache-control': 'no-store' }
  });
}













