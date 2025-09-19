import { test, expect } from '@playwright/test';
import { postJson, fetchJson, expectOk, defaultHeaders } from './helpers';

// Merk: kjøres lokalt med dev-bypass (TEST_AUTH_BYPASS=1) og egen port.
// Bruker defaultHeaders (x-test-clerk-user-id/email) for simulert innlogging.

test.describe('Profil E2E: org-flow (velg → context → bytt → forlat)', () => {
  test('happy path', async ({ request }) => {
    // 1) Søk/seed forutsettes i data; bruk et kjent orgnr hvis tilgjengelig
    const TEST_ORGNR = process.env.TEST_ORGNR || '918654062';

    // 2) Velg org via orgnr
    const sel = await postJson(request, '/api/org/select', { orgnr: TEST_ORGNR });
    await expectOk(sel);
    const selJson = await sel.json();
    expect(selJson.organization_id).toBeTruthy();

    // 3) Context skal vise valgt org
    const ctx = await request.get('/api/profile/context', { headers: defaultHeaders });
    const ctxJson = await ctx.json();
    expect(ctx.status()).toBe(200);
    expect(ctxJson?.ok).toBe(true);
    expect(ctxJson?.organization?.id).toBe(selJson.organization_id);

    // 4) Hent alle org’er for bruker
    const orgsRes = await request.get('/api/profile/organizations', { headers: defaultHeaders });
    const orgs = await orgsRes.json();
    expect(orgsRes.status()).toBe(200);
    expect(orgs?.ok).toBe(true);
    expect(Array.isArray(orgs.organizations)).toBe(true);

    // 5) Hvis det finnes en annen org i lista, bytt til den
    const other = (orgs.organizations as any[]).find(o => o.organization_id !== selJson.organization_id);
    if (other) {
      const sel2 = await postJson(request, '/api/org/select', { organization_id: other.organization_id });
      await expectOk(sel2);
      const ctx2 = await request.get('/api/profile/context', { headers: defaultHeaders });
      const ctx2Json = await ctx2.json();
      expect(ctx2Json?.organization?.id).toBe(other.organization_id);
    }

    // 6) Forlat org hvis ikke owner
    const ctx3 = await request.get('/api/profile/context', { headers: defaultHeaders });
    const ctx3Json = await ctx3.json();
    if (ctx3Json?.membership?.role !== 'owner' && ctx3Json?.organization?.id) {
      const leave = await postJson(request, '/api/profile/leave', { organization_id: ctx3Json.organization.id });
      await expectOk(leave);
      const ctx4 = await request.get('/api/profile/context', { headers: defaultHeaders });
      const ctx4Json = await ctx4.json();
      expect(ctx4Json?.organization).toBeNull();
    }
  });
});
