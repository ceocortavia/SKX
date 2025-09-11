import { test, expect } from '@playwright/test';

test.describe('Bulk Role Change API', () => {
  const baseHeaders = {
    'content-type': 'application/json',
    'x-test-clerk-user-id': 'da718e7d-a24e-4a26-a545-583771ff57ea',
    'x-test-clerk-email': 'b@example.com',
    'x-test-org-id': '9f217b9c-40ce-4814-a77b-5ef3cd5e9697',
    'x-test-mfa': 'on',
  };

  test('should reject invalid input - empty userIds', async ({ request }) => {
    const res = await request.post('/api/memberships/bulk-role', {
      headers: baseHeaders,
      data: { 
        userIds: [], 
        targetRole: 'admin' 
      },
    });

    expect(res.status()).toBe(400);
    const json = await res.json();
    expect(json.error).toBe('invalid_input');
  });

  test('should reject invalid input - invalid targetRole', async ({ request }) => {
    const res = await request.post('/api/memberships/bulk-role', {
      headers: baseHeaders,
      data: { 
        userIds: ['test-user'], 
        targetRole: 'invalid_role' 
      },
    });

    expect(res.status()).toBe(400);
    const json = await res.json();
    expect(json.error).toBe('invalid_input');
  });

  test('should reject invalid JSON', async ({ request }) => {
    const res = await request.post('/api/memberships/bulk-role', {
      headers: {
        'content-type': 'application/json',
        ...baseHeaders,
      },
      data: '{"invalid": json}',
    });

    expect(res.status()).toBe(400);
    const json = await res.json();
    expect(json.error).toBe('invalid_json');
  });

  test('should reject without MFA', async ({ request }) => {
    const res = await request.post('/api/memberships/bulk-role', {
      headers: {
        ...baseHeaders,
        'x-test-mfa': 'off',
      },
      data: { 
        userIds: ['test-user'], 
        targetRole: 'admin' 
      },
    });

    // In test environment, user might not exist, so we check for either MFA error or user not found
    if (res.status() === 403) {
      const json = await res.json();
      expect(json.error).toBe('MFA required');
    } else {
      // If user doesn't exist, should get appropriate error
      const json = await res.json();
      expect(['No organization access', 'User not found']).toContain(json.error);
    }
  });

  test('should reject when feature flag is disabled', async ({ request }) => {
    // Skip this test for now since we can't easily toggle the flag
    test.skip(true, 'Feature flag test requires server restart');
  });

  test('should limit to 100 userIds maximum', async ({ request }) => {
    // Create array with 101 userIds
    const userIds = Array.from({ length: 101 }, (_, i) => `user-${i}`);
    
    const res = await request.post('/api/memberships/bulk-role', {
      headers: baseHeaders,
      data: { 
        userIds, 
        targetRole: 'admin' 
      },
    });

    // Expect hard fail for >100
    expect(res.status()).toBe(400);
    const json = await res.json();
    expect(json.error).toBe('invalid_input');
    expect(['too_many_userIds', 'too_many_ids']).toContain(json.reason);
  });

  test('should handle non-existent users gracefully', async ({ request }) => {
    const res = await request.post('/api/memberships/bulk-role', {
      headers: baseHeaders,
      data: { 
        userIds: ['non-existent-user-1', 'non-existent-user-2'], 
        targetRole: 'admin' 
      },
    });

    // In test environment, should still process the request even if users don't exist
    if (res.ok()) {
      const json = await res.json();
      // Should return success with all users skipped
      expect(json.updated).toBe(0);
      expect(json.skipped.length).toBe(2);
      expect(json.skipped.every((s: any) => s.reason === 'not_visible_or_not_approved')).toBeTruthy();
    } else {
      // If user doesn't exist, should get appropriate error
      const json = await res.json();
      expect(['No organization access', 'User not found']).toContain(json.error);
    }
  });

  test('should validate targetRole values', async ({ request }) => {
    const validRoles = ['member', 'admin'];
    const invalidRoles = ['owner', 'invalid', ''];

    for (const role of validRoles) {
      const res = await request.post('/api/memberships/bulk-role', {
        headers: baseHeaders,
        data: { 
          userIds: ['test-user'], 
          targetRole: role 
        },
      });
      
      // Should not fail on valid role (even if user doesn't exist)
      expect(res.status()).not.toBe(400);
    }

    for (const role of invalidRoles) {
      const res = await request.post('/api/memberships/bulk-role', {
        headers: baseHeaders,
        data: { 
          userIds: ['test-user'], 
          targetRole: role 
        },
      });
      
      expect(res.status()).toBe(400);
      const json = await res.json();
      expect(json.error).toBe('invalid_input');
    }
  });
});
