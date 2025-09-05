import { test } from '@playwright/test';
import { postJson, expectInvalidJson, expectInvalidInput, makeIds, defaultHeaders } from './helpers';

test.describe('Bulk Approve API - validation', () => {
  const url = '/api/memberships/bulk-approve';

  test('malformed JSON -> 400 invalid_json', async ({ request }) => {
    const res = await request.post(url, {
      data: '{ not_json',
      headers: { ...defaultHeaders },
    });
    await expectInvalidJson(res);
  });

  test('empty userIds -> 400 invalid_input (empty_userIds)', async ({ request }) => {
    const res = await postJson(request, url, { userIds: [] });
    await expectInvalidInput(res, 'empty_userIds');
  });

  test('too many userIds (>100) -> 400 invalid_input (too_many_userIds)', async ({ request }) => {
    const res = await postJson(request, url, { userIds: makeIds(101, 'u_') });
    await expectInvalidInput(res, 'too_many_userIds');
  });
});

test.describe('Bulk Revoke Members API - validation', () => {
  const url = '/api/memberships/bulk-revoke';

  test('malformed JSON -> 400 invalid_json', async ({ request }) => {
    const res = await request.post(url, {
      data: '{ not_json',
      headers: { ...defaultHeaders },
    });
    await expectInvalidJson(res);
  });

  test('empty userIds -> 400 invalid_input (empty_userIds)', async ({ request }) => {
    const res = await postJson(request, url, { userIds: [] });
    await expectInvalidInput(res, 'empty_userIds');
  });

  test('too many userIds (>100) -> 400 invalid_input (too_many_userIds)', async ({ request }) => {
    const res = await postJson(request, url, { userIds: makeIds(101, 'u_') });
    await expectInvalidInput(res, 'too_many_userIds');
  });
});

test.describe('Invitations Bulk Revoke API - validation', () => {
  const url = '/api/invitations/bulk-revoke';

  test('malformed JSON -> 400 invalid_json', async ({ request }) => {
    const res = await request.post(url, {
      data: '{ not_json',
      headers: { ...defaultHeaders },
    });
    await expectInvalidJson(res);
  });

  test('empty invitationIds -> 400 invalid_input (empty_invitationIds)', async ({ request }) => {
    const res = await postJson(request, url, { invitationIds: [] });
    await expectInvalidInput(res, 'empty_invitationIds');
  });

  test('too many invitationIds (>100) -> 400 invalid_input (too_many_invitationIds)', async ({ request }) => {
    const res = await postJson(request, url, { invitationIds: makeIds(101, 'i_') });
    await expectInvalidInput(res, 'too_many_invitationIds');
  });
});



