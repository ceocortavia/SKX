import { test, expect, request as pwrequest } from '@playwright/test';
import { postJson, fetchJson, expectOk } from './helpers';

test.describe('Profile: org selection E2E', () => {
  test('velg org (orgnr) persisteres og gjenspeiles i context', async ({ request }) => {
    const orgnr = '974761076'; // Skatteetaten (trygt å slå opp i BRREG)

    const sel = await postJson(request, '/api/org/select', { orgnr });
    const selJson = await sel.json();
    expect(sel.ok()).toBeTruthy();
    expect(selJson.ok).toBe(true);
    expect(selJson.organization_id).toBeTruthy();

    const { res: ctxRes, json: ctxJson } = await fetchJson(request, '/api/profile/context', { 'cache-control': 'no-store' });
    expect(ctxRes.ok()).toBeTruthy();
    expect(ctxJson.ok ?? true).toBeTruthy();
    const org = (ctxJson.context ?? ctxJson.organization);
    expect(org?.organization_id || org?.id).toBeTruthy();
  });
});




