import crypto from 'crypto';
import { maskinportenConfig } from './env';

type CachedToken = {
  token: string;
  expiresAt: number;
};

const cache: Record<string, CachedToken> = {};

function base64UrlEncode(buffer: Buffer): string {
  return buffer
    .toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}

function createClientAssertion(params: {
  tokenUrl: string;
  clientId: string;
  issuer?: string;
  privateKeyBase64: string;
}): string {
  const now = Math.floor(Date.now() / 1000);
  const header = {
    alg: 'RS256',
    typ: 'JWT',
  };
  const payload = {
    iss: params.issuer || params.clientId,
    sub: params.clientId,
    aud: params.tokenUrl,
    jti: crypto.randomUUID(),
    iat: now,
    exp: now + 120,
  };

  const encodedHeader = base64UrlEncode(Buffer.from(JSON.stringify(header)));
  const encodedPayload = base64UrlEncode(Buffer.from(JSON.stringify(payload)));
  const signingInput = `${encodedHeader}.${encodedPayload}`;

  const key = crypto.createPrivateKey({
    key: Buffer.from(params.privateKeyBase64, 'base64'),
    format: 'der',
    type: 'pkcs8',
  });

  const signer = crypto.createSign('RSA-SHA256');
  signer.update(signingInput);
  const signature = signer.sign(key);
  return `${signingInput}.${base64UrlEncode(signature)}`;
}

export async function getMaskinportenToken(): Promise<string> {
  const cfg = maskinportenConfig();
  if (cfg.mode !== 'authorised') {
    throw new Error('Maskinporten token requested but BRREG_MODE is not authorised');
  }
  const cacheKey = `${cfg.clientId}:${cfg.scope}`;
  const cached = cache[cacheKey];
  const now = Date.now();
  if (cached && cached.expiresAt > now + 5000) {
    return cached.token;
  }

  if (!cfg.tokenUrl || !cfg.clientId || !cfg.scope || !cfg.privateKeyBase64) {
    throw new Error('Maskinporten configuration is incomplete');
  }

  const assertion = createClientAssertion({
    tokenUrl: cfg.tokenUrl,
    clientId: cfg.clientId,
    issuer: cfg.issuer,
    privateKeyBase64: cfg.privateKeyBase64,
  });

  const params = new URLSearchParams({
    grant_type: 'client_credentials',
    client_assertion_type: 'urn:ietf:params:oauth:client-assertion-type:jwt-bearer',
    client_assertion: assertion,
    scope: cfg.scope,
  });
  if (cfg.resource) {
    params.set('resource', cfg.resource);
  }

  const res = await fetch(cfg.tokenUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: params,
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Maskinporten token request failed (${res.status}): ${text}`);
  }
  const data = (await res.json()) as { access_token: string; expires_in: number };
  if (!data.access_token) {
    throw new Error('Maskinporten response missing access_token');
  }
  cache[cacheKey] = {
    token: data.access_token,
    expiresAt: now + Math.max((data.expires_in ?? 120) * 1000, 60000),
  };
  return data.access_token;
}

