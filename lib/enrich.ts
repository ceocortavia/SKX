import type { PoolClient } from 'pg';

import { BRREG_OPEN, getBrregRequestHeaders } from './brreg';

type EnrichedOrg = {
  orgnr: string;
  name?: string | null;
  org_form?: string | null;
  registered_at?: string | null; // ISO string
  status_text?: string | null;
  raw_brreg_json?: any;
  industry_code?: string | null;
  address?: string | null;
  ceo_name?: string | null;
  revenue?: number | null;
};

function isTruthyEnv(value: string | undefined): boolean {
  if (!value) return false;
  const v = value.toLowerCase();
  return v === '1' || v === 'true' || v === 'yes';
}

type FetchJsonResult = { ok: boolean; status: number; ms: number; json: any };

async function fetchJSON(url: string, init: RequestInit = {}, timeoutMs = 7000): Promise<FetchJsonResult> {
  const controller = new AbortController();
  const startedAt = Date.now();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const headersFromInit = (() => {
      if (!init.headers) return {} as Record<string, string>;
      if (init.headers instanceof Headers) {
        return Object.fromEntries(init.headers.entries());
      }
      if (Array.isArray(init.headers)) {
        return Object.fromEntries(init.headers);
      }
      return init.headers as Record<string, string>;
    })();
    const mergedHeaders = {
      ...getBrregRequestHeaders(),
      ...headersFromInit,
    };
    const res = await fetch(url, {
      ...init,
      headers: mergedHeaders,
      signal: controller.signal,
      cache: 'no-store' as RequestCache,
    });
    const text = await res.text();
    let json: any;
    try {
      json = text ? JSON.parse(text) : null;
    } catch {
      json = { _raw: text?.slice(0, 500) };
    }
    return { ok: res.ok, status: res.status, ms: Date.now() - startedAt, json };
  } finally {
    clearTimeout(timer);
  }
}

async function fetchBrreg(orgnr: string): Promise<Partial<EnrichedOrg> | null> {
  if (isTruthyEnv(process.env.MOCK_BRREG)) {
    return {
      orgnr,
      name: 'Mockt organisasjon',
      org_form: 'AS',
      registered_at: new Date('2010-01-01').toISOString(),
      status_text: 'AKTIV',
      raw_brreg_json: { mock: true },
      industry_code: '62.010',
      address: 'Storgata 1, 0001 Oslo'
    };
  }
  try {
    const mode = process.env.BRREG_MODE || 'open';
    // Authorized mode kan legges til senere; vi faller uansett tilbake til åpent API
    if (mode !== 'open') {
      console.warn('[enrich.brreg] BRREG_MODE set to', mode, '— using open fallback');
    }

    const r = await fetchJSON(`${BRREG_OPEN}/enheter/${orgnr}`);
    if (!r.ok) {
      console.warn('[enrich.brreg] open fetch failed', { status: r.status, ms: r.ms, orgnr });
      return null;
    }
    const data: any = r.json;
    const navn = data?.navn ?? null;
    const orgForm = data?.organisasjonsform?.kode ?? null;
    const regdt = data?.registreringsdatoEnhetsregisteret || data?.registreringsdatoEnhetsregisteret?.dato || null;
    const slettet = data?.slettedato ?? data?.slettetDato;
    const status = slettet ? 'SLETTET' : 'AKTIV';
    // adresse
    const addrObj = data?.forretningsadresse || data?.forretningsAdresse || data?.beliggenhetsadresse;
    const addr = addrObj ? [addrObj?.adresse || addrObj?.adresse?.join?.(' '), addrObj?.postnummer, addrObj?.poststed]
      .filter(Boolean).join(', ') : null;
    const nace = (data?.naeringskode1?.kode || data?.naeringskode1?.kode?.toString?.()) ?? null;
    return {
      orgnr,
      name: navn,
      org_form: orgForm,
      registered_at: regdt ? new Date(regdt).toISOString() : null,
      status_text: status,
      raw_brreg_json: data,
      industry_code: nace,
      address: addr
    };
  } catch (e: any) {
    console.error('[enrich.brreg] exception', { err: String(e?.message || e), orgnr });
    return null;
  }
}

async function fetchProff(orgnr: string): Promise<Partial<EnrichedOrg>> {
  // Placeholder: Proff har ingen offentlig gratis API; her må man ha key/proxy.
  // Vi støtter mock via env, ellers returnerer vi tomme felter.
  if (isTruthyEnv(process.env.MOCK_PROFF)) {
    return { ceo_name: 'Kari Leder', revenue: 123456789 };
  }
  return {};
}

async function fetchPurehelp(orgnr: string): Promise<Partial<EnrichedOrg>> {
  if (isTruthyEnv(process.env.MOCK_PUREHELP)) {
    return { ceo_name: 'Ola Daglig Leder', revenue: 234567890 };
  }
  return {};
}

export async function enrichOrganizationData(orgnr: string, client: PoolClient): Promise<void> {
  if (!/^\d{9}$/.test(orgnr)) return;

  // 1) Brønnøysund først
  const brreg = await fetchBrreg(orgnr);

  // 2) Proff.no deretter
  const proff = await fetchProff(orgnr);

  // 3) Purehelp.no
  const pure = await fetchPurehelp(orgnr);

  const merged: EnrichedOrg = {
    orgnr,
    name: brreg?.name ?? null,
    org_form: brreg?.org_form ?? null,
    registered_at: brreg?.registered_at ?? null,
    status_text: brreg?.status_text ?? null,
    raw_brreg_json: brreg?.raw_brreg_json ?? null,
    industry_code: brreg?.industry_code ?? null,
    address: brreg?.address ?? null,
    ceo_name: proff?.ceo_name ?? pure?.ceo_name ?? null,
    revenue: (proff?.revenue as number | undefined) ?? (pure?.revenue as number | undefined) ?? null
  };

  // Upsert til organizations
  // Merk: Vi holder oss til feltene definert i 010_base_schema + utvidelser.
  await client.query(
    `insert into public.organizations (orgnr, name, org_form, registered_at, status_text, raw_brreg_json, industry_code, address, ceo_name, revenue)
     values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
     on conflict (orgnr) do update set
       name = excluded.name,
       org_form = excluded.org_form,
       registered_at = excluded.registered_at,
       status_text = excluded.status_text,
       raw_brreg_json = excluded.raw_brreg_json,
       industry_code = excluded.industry_code,
       address = excluded.address,
       ceo_name = excluded.ceo_name,
       revenue = excluded.revenue,
       updated_at = now()`,
    [
      merged.orgnr,
      merged.name,
      merged.org_form,
      merged.registered_at ? new Date(merged.registered_at) : null,
      merged.status_text,
      merged.raw_brreg_json,
      merged.industry_code,
      merged.address,
      merged.ceo_name,
      merged.revenue ?? null
    ]
  );
}
