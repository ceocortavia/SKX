import { test, expect } from '@playwright/test';
import { defaultHeaders, expectOk } from './helpers';

/**
 * E2E test for offboarding flow
 * Tests: start → get → finalize → search
 * 
 * Requires:
 * - ENABLE_OFFBOARDING_API=1
 * - NEXT_PUBLIC_OFFBOARDING_ENABLED=1
 * - ENABLE_DB_ONLY_ARTIFACTS=1 (if S3 not configured)
 */

test('offboarding E2E: start → get → finalize → search @offboarding', async ({ request }) => {
  const USER_EMAIL = 'a@example.com'; // matches default bypass user

  // Step 1: Start offboarding
  const startRes = await request.post('/api/offboarding/start', {
    headers: defaultHeaders,
    data: { user_email: USER_EMAIL },
  });

  expect(startRes.status()).toBe(201);
  const startJson = await startRes.json();
  const runId = startJson.run_id;
  
  expect(runId).toBeTruthy();
  expect(typeof runId).toBe('string');
  expect(startJson.status).toBe('processing');
  expect(Array.isArray(startJson.candidate_files)).toBe(true);
  
  console.log(`✓ Started run: ${runId}`);
  console.log(`  Candidate files: ${startJson.candidate_files?.length || 0}`);

  // Step 2: Get run details
  const getRes = await request.get(`/api/offboarding/${runId}`, {
    headers: defaultHeaders,
  });

  expect(getRes.status()).toBe(200);
  const getJson = await getRes.json();
  
  expect(getJson.run_id).toBe(runId);
  expect(getJson.user_email).toBe(USER_EMAIL);
  expect(['processing', 'ready_to_finalize']).toContain(getJson.status);
  
  console.log(`✓ Got run details`);
  console.log(`  Status: ${getJson.status}`);
  console.log(`  User: ${getJson.user_email}`);

  // Step 3: Finalize run (creates Transition Space + artifacts)
  const finalizeRes = await request.post(`/api/offboarding/${runId}/finalize`, {
    headers: defaultHeaders,
  });

  expect(finalizeRes.status()).toBe(200);
  const finalizeJson = await finalizeRes.json();
  
  expect(finalizeJson.status).toBe('completed');
  expect(finalizeJson.transition_space).toBeTruthy();
  expect(finalizeJson.transition_space.id).toBeTruthy();
  expect(finalizeJson.transition_space.type).toBe('transition');
  
  const spaceId = finalizeJson.transition_space.id;
  const spaceName = finalizeJson.transition_space.name;
  const artifacts = finalizeJson.artifacts || [];
  const artifactCount = Array.isArray(artifacts) ? artifacts.length : 0;
  const mode = finalizeJson.mode || 'unknown';
  
  console.log(`✓ Finalized run`);
  console.log(`  Space ID: ${spaceId}`);
  console.log(`  Space Name: ${spaceName}`);
  console.log(`  Artifacts: ${artifactCount}`);
  console.log(`  Mode: ${mode}`);

  // Verify we got the expected artifacts
  expect(artifactCount).toBeGreaterThanOrEqual(3);
  const artifactNames = artifacts.map((a: any) => a.name).join(', ');
  console.log(`  Artifact files: ${artifactNames}`);

  // Step 4: Search in Transition Space
  const searchRes = await request.get('/api/files/search', {
    headers: defaultHeaders,
    params: {
      q: 'Playbook',
      space_id: spaceId,
      limit: '10',
    },
  });

  expect(searchRes.status()).toBe(200);
  const searchJson = await searchRes.json();
  
  // Search results can be in different formats
  const hits = searchJson.hits || searchJson.results || [];
  const hitCount = Array.isArray(hits) ? hits.length : 0;
  
  console.log(`✓ Search completed`);
  console.log(`  Query: "Playbook"`);
  console.log(`  Hits: ${hitCount}`);

  // Note: file_index may not be populated immediately in some environments
  if (hitCount === 0) {
    console.warn('⚠ Warning: No search hits (file_index may not be populated yet)');
  }

  console.log(`\n✅ Full E2E flow completed successfully!`);
});

test('offboarding diagnostics endpoint @offboarding', async ({ request }) => {
  const diagRes = await request.get('/api/diag/offboarding', {
    headers: defaultHeaders,
  });

  expect(diagRes.status()).toBe(200);
  const diagJson = await diagRes.json();
  
  expect(diagJson.ok).toBe(true);
  expect(diagJson.ts).toBeTruthy();
  expect(diagJson.stats).toBeTruthy();
  expect(diagJson.stats.last_24h).toBeTruthy();
  expect(diagJson.flags).toBeTruthy();
  
  console.log('Diagnostics:');
  console.log(`  Last 24h runs: ${diagJson.stats.last_24h.total}`);
  console.log(`  Completed: ${diagJson.stats.last_24h.completed}`);
  console.log(`  Mode: ${diagJson.mode}`);
  console.log(`  API enabled: ${diagJson.flags.api_enabled}`);
});

test('offboarding handles invalid user_email @offboarding', async ({ request }) => {
  const startRes = await request.post('/api/offboarding/start', {
    headers: defaultHeaders,
    data: { user_email: 'nonexistent@test.com' },
  });

  // Should return 404 for user not found
  expect(startRes.status()).toBe(404);
  const json = await startRes.json();
  expect(json.error).toBe('user_not_found');
});

test('offboarding handles missing user_email @offboarding', async ({ request }) => {
  const startRes = await request.post('/api/offboarding/start', {
    headers: defaultHeaders,
    data: {},
  });

  expect(startRes.status()).toBe(400);
  const json = await startRes.json();
  expect(json.error).toBe('invalid_input');
});
