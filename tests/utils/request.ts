import { APIRequestContext } from '@playwright/test';

export async function postJson(
  request: APIRequestContext,
  url: string,
  body: unknown,
  headers: Record<string, string> = {}
) {
  const res = await request.post(url, {
    data: body,
    headers: { 'content-type': 'application/json', ...headers },
  });
  return res;
}

export async function postText(
  request: APIRequestContext,
  url: string,
  raw: string,
  headers: Record<string, string> = {}
) {
  const res = await request.post(url, {
    data: raw,
    headers: { 'content-type': 'application/json', ...headers },
  });
  return res;
}

export const DEV_BYPASS_HEADERS = {
  'x-test-clerk-user-id': 'da718e7d-a24e-4a26-a545-583771ff57ea',
  'x-test-clerk-email': 'b@example.com',
  'x-test-org-id': '9f217b9c-40ce-4814-a77b-5ef3cd5e9697',
  'x-test-mfa': 'on',
};








