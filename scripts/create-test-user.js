/*
  Create a Clerk test user, select an org via API with test-bypass, then verify in Neon.
  Env needed (can be loaded by sourcing .env.vercel before running):
    - CLERK_SECRET_KEY
    - TEST_SEED_SECRET
    - NEXT_PUBLIC_SITE_URL (fallback used if missing)
    - DATABASE_URL_UNPOOLED
*/

const { Client } = require('pg');

async function main() {
  const clerkSecret = process.env.CLERK_SECRET_KEY;
  const testSecret = process.env.TEST_SEED_SECRET;
  const site = process.env.NEXT_PUBLIC_SITE_URL || 'https://skx-prod.vercel.app';
  const dbUrl = process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL;

  if (!clerkSecret) throw new Error('Missing CLERK_SECRET_KEY');
  if (!testSecret) throw new Error('Missing TEST_SEED_SECRET');
  if (!dbUrl) throw new Error('Missing DATABASE_URL_UNPOOLED');

  const email = `test+${Date.now()}@example.com`;
  console.log(`Creating Clerk user: ${email}`);
  const strongPassword = `S${Date.now()}!aA9x#`;
  const createRes = await fetch('https://api.clerk.com/v1/users', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${clerkSecret}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ email_address: [email], password: strongPassword }),
  });
  if (!createRes.ok) {
    const txt = await createRes.text();
    throw new Error(`Clerk create failed: ${createRes.status} ${txt}`);
  }
  const created = await createRes.json();
  const clerkUserId = created.id;
  if (!clerkUserId) throw new Error('No Clerk user id returned');
  console.log(`Clerk user id: ${clerkUserId}`);

  console.log('Selecting org via /api/org/select (orgnr) ...');
  let orgSelect = await fetch(`${site}/api/org/select`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-test-secret': testSecret,
      'x-test-clerk-user-id': clerkUserId,
      'x-test-clerk-email': email,
    },
    body: JSON.stringify({ orgnr: '918654062' }),
  });
  let orgJson = await safeJson(orgSelect);
  console.log('org/select (orgnr):', orgSelect.status, orgJson);
  if (!orgSelect.ok || !orgJson?.organization_id) {
    // Fallback: direkte organization_id
    console.log('Retry with organization_id ...');
    orgSelect = await fetch(`${site}/api/org/select`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-test-secret': testSecret,
        'x-test-clerk-user-id': clerkUserId,
        'x-test-clerk-email': email,
      },
      body: JSON.stringify({ organization_id: '92d52da4-fbff-4e9b-bb8d-17c170352aac' }),
    });
    orgJson = await safeJson(orgSelect);
    console.log('org/select (id):', orgSelect.status, orgJson);
    if (!orgSelect.ok || !orgJson?.organization_id) {
      throw new Error('org/select did not return organization_id');
    }
  }

  console.log('Verifying in Neon ...');
  const client = new Client({ connectionString: dbUrl });
  await client.connect();
  try {
    const r1 = await client.query(
      `select id, clerk_user_id, primary_email, created_at from public.users where clerk_user_id=$1`,
      [clerkUserId]
    );
    const r2 = await client.query(
      `select u.clerk_user_id, u.primary_email, uos.organization_id, o.name, o.orgnr, uos.updated_at
       from public.users u
       left join public.user_org_selection uos on uos.user_id = u.id
       left join public.organizations o on o.id = uos.organization_id
       where u.clerk_user_id = $1`,
      [clerkUserId]
    );
    const r3 = await client.query(
      `select o.name, o.orgnr, m.role, m.status
       from public.memberships m
       join public.users u on u.id = m.user_id
       join public.organizations o on o.id = m.organization_id
       where u.clerk_user_id = $1`,
      [clerkUserId]
    );
    console.log('users:', r1.rows);
    console.log('selection:', r2.rows);
    console.log('memberships:', r3.rows);
  } finally {
    await client.end();
  }

  console.log('Done.');
}

function safeJson(res) {
  return res
    .json()
    .catch(async () => ({ _text: await res.text().catch(() => null) }));
}

main().catch((err) => {
  console.error('ERROR:', err?.message || err);
  process.exit(1);
});


