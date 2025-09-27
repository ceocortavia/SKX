import { redisGet, redisSet } from './cache';
import { maskinportenConfig } from './env';
import { getMaskinportenToken } from './maskinporten';
import { fullmaktConfig } from './env';

export interface BrregUnit {
  organisasjonsnummer: string;
  navn?: string;
  organisasjonsform?: { kode?: string; beskrivelse?: string };
  registreringsdatoEnhetsregisteret?: string;
  forretningsadresse?: Record<string, unknown>;
  naeringskode1?: Record<string, unknown>;
  [key: string]: unknown;
}

export interface BrregRolesResponse {
  roller: unknown;
  [key: string]: unknown;
}

export interface BrregFullmaktResponse {
  signatur?: unknown;
  prokura?: unknown;
  roller?: unknown;
  [key: string]: unknown;
}

const BRREG_CACHE_PREFIX = 'brreg:v1';

function normalizeOrgnr(orgnr: string): string {
  const digits = orgnr.replace(/\D/g, '');
  if (digits.length !== 9) {
    throw new Error('orgnr must be 9 digits');
  }
  return digits;
}

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: {
      Accept: 'application/json',
      ...(init?.headers ?? {}),
    },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Request to ${url} failed (${res.status}): ${text}`);
  }
  return res.json() as Promise<T>;
}

export async function getBrreg(orgnrRaw: string, includeSubunits: boolean): Promise<{ mainUnit: BrregUnit; subUnits?: BrregUnit[] } | null> {
  const orgnr = normalizeOrgnr(orgnrRaw);
  const cacheKey = `${BRREG_CACHE_PREFIX}:unit:${orgnr}:${includeSubunits ? '1' : '0'}`;
  const cached = await redisGet<{ mainUnit: BrregUnit; subUnits?: BrregUnit[] }>(cacheKey);
  if (cached) return cached;

  const mainUnit = await fetchJson<BrregUnit>(`https://data.brreg.no/enhetsregisteret/api/enheter/${orgnr}`);
  let subUnits: BrregUnit[] | undefined;
  if (includeSubunits) {
    const url = new URL('https://data.brreg.no/enhetsregisteret/api/enheter');
    url.searchParams.set('overordnetEnhet', orgnr);
    url.searchParams.set('size', '100');
    const response = await fetchJson<{ _embedded?: { enheter?: BrregUnit[] } }>(url.toString());
    subUnits = response._embedded?.enheter ?? [];
  }

  const payload = { mainUnit, subUnits };
  await redisSet(cacheKey, payload);
  return payload;
}

export async function getBrregRoles(orgnrRaw: string): Promise<BrregRolesResponse | null> {
  const orgnr = normalizeOrgnr(orgnrRaw);
  const cfg = maskinportenConfig();
  const cacheKey = `${BRREG_CACHE_PREFIX}:roles:${cfg.mode}:${orgnr}`;
  const cached = await redisGet<BrregRolesResponse>(cacheKey);
  if (cached) return cached;

  let url = `https://data.brreg.no/enhetsregisteret/api/enheter/${orgnr}/roller`;
  const headers: Record<string, string> = { Accept: 'application/json' };

  if (cfg.mode === 'authorised') {
    url = `https://data.brreg.no/enhetsregisteret/autorisert-api/enheter/${orgnr}/roller`;
    const token = await getMaskinportenToken();
    headers.Authorization = `Bearer ${token}`;
  }

  const roles = await fetchJson<BrregRolesResponse>(url, { headers });
  await redisSet(cacheKey, roles);
  return roles;
}

export async function getSignaturProkura(orgnrRaw: string): Promise<BrregFullmaktResponse | null> {
  const orgnr = normalizeOrgnr(orgnrRaw);
  const cfg = fullmaktConfig();
  if (!cfg) {
    throw new Error('FULLMAKT_BASE_URL and FULLMAKT_TOKEN must be set to call get_signatur_prokura');
  }
  const cacheKey = `${BRREG_CACHE_PREFIX}:prokura:${orgnr}`;
  const cached = await redisGet<BrregFullmaktResponse>(cacheKey);
  if (cached) return cached;

  const base = cfg.baseUrl.replace(/\/+$/, '');
  const url = `${base}/organisasjoner/${orgnr}`;
  const response = await fetchJson<BrregFullmaktResponse>(url, {
    headers: {
      Authorization: `Bearer ${cfg.token}`,
    },
  });
  await redisSet(cacheKey, response);
  return response;
}
