import { test, expect } from '@playwright/test';

const superHeaders = {
  'x-test-clerk-user-id': 'platform_admin',
  'x-test-clerk-email': 'platform@example.com',
};

test('platform admin can list organizations and update member status', async ({ request }) => {
  const statsRes = await request.get('/api/platform/stats', {
    headers: { ...superHeaders, 'accept': 'application/json' },
  });
  expect(statsRes.status(), 'stats status').toBe(200);
  const statsJson = await statsRes.json();
  expect(statsJson?.ok).toBe(true);
  expect(statsJson?.stats?.organizations).toBeGreaterThanOrEqual(0);

  await request.delete('/api/platform/admins', {
    headers: { ...superHeaders, 'content-type': 'application/json' },
    data: JSON.stringify({ email: 'b@example.com' }),
  });

  const orgRes = await request.get('/api/platform/organizations', {
    headers: { ...superHeaders, 'accept': 'application/json' },
  });
  expect(orgRes.status(), 'org status').toBe(200);
  const orgJson = await orgRes.json();
  expect(orgJson?.ok).toBe(true);
  expect(Array.isArray(orgJson?.organizations)).toBe(true);
  expect(orgJson.organizations.length).toBeGreaterThan(0);

  const targetOrg = orgJson.organizations[0];
  expect(typeof targetOrg.id).toBe('string');

  const membersRes = await request.get(`/api/platform/members?organizationId=${targetOrg.id}`, {
    headers: { ...superHeaders, 'accept': 'application/json' },
  });
  expect(membersRes.status(), 'members status').toBe(200);
  const membersJson = await membersRes.json();
  expect(membersJson?.ok).toBe(true);
  expect(Array.isArray(membersJson?.members)).toBe(true);
  expect(membersJson.members.length).toBeGreaterThan(0);

  const member = membersJson.members[0];
  const nextStatus = member.status === 'approved' ? 'pending' : 'approved';

  const updateRes = await request.patch('/api/platform/members', {
    headers: { ...superHeaders, 'content-type': 'application/json' },
    data: JSON.stringify({
      organizationId: member.organization_id,
      userId: member.user_id,
      status: nextStatus,
    }),
  });
  expect(updateRes.status(), 'update status').toBe(200);
  const updateJson = await updateRes.json();
  expect(updateJson?.ok).toBe(true);
  expect(updateJson?.membership?.status).toBe(nextStatus);

  // revert to original status to keep seed stable
  const revertRes = await request.patch('/api/platform/members', {
    headers: { ...superHeaders, 'content-type': 'application/json' },
    data: JSON.stringify({
      organizationId: member.organization_id,
      userId: member.user_id,
      status: member.status,
    }),
  });
  expect(revertRes.status(), 'revert status').toBe(200);
  const revertJson = await revertRes.json();
  expect(revertJson?.ok).toBe(true);
  expect(revertJson?.membership?.status).toBe(member.status);

  const adminsRes = await request.get('/api/platform/admins', {
    headers: { ...superHeaders, 'accept': 'application/json' },
  });
  expect(adminsRes.status(), 'admins status').toBe(200);
  const adminsJson = await adminsRes.json();
  expect(adminsJson?.ok).toBe(true);

  const addRes = await request.post('/api/platform/admins', {
    headers: { ...superHeaders, 'content-type': 'application/json' },
    data: JSON.stringify({ email: 'b@example.com' }),
  });
  expect(addRes.status(), 'add admin status').toBe(200);
  const addJson = await addRes.json();
  expect(addJson?.ok).toBe(true);

  const delRes = await request.delete('/api/platform/admins', {
    headers: { ...superHeaders, 'content-type': 'application/json' },
    data: JSON.stringify({ email: 'b@example.com' }),
  });
  expect(delRes.status(), 'delete admin status').toBe(200);
  const delJson = await delRes.json();
  expect(delJson?.ok).toBe(true);
});
