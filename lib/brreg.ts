function isTruthyEnv(value: string | undefined): boolean {
  if (!value) return false;
  const v = value.toLowerCase();
  return v === '1' || v === 'true' || v === 'yes';
}

export interface BrregOrgDetails {
  orgnr: string;
  name?: string | null;
  org_form?: string | null;
  registered_at?: string | null;
  status_text?: string | null;
  address?: string | null;
  industry_code?: string | null;
  raw_json?: any;
}

export const BRREG_OPEN = 'https://data.brreg.no/enhetsregisteret/api';

export type BrregResult<T = any> = {
  ok: boolean;
  status: number;
  data?: T;
  error?: string;
  fetchedAt: number;
};

async function fetchOpen<T>(orgnr: string): Promise<BrregResult<T>> {
  const url = `${BRREG_OPEN}/enheter/${orgnr}`;
  const t0 = Date.now();
  try {
    const res = await fetch(url, { headers: { accept: 'application/json' }, cache: 'no-store' });
    const fetchedAt = Date.now();
    if (!res.ok) {
      return { ok: false, status: res.status, error: `open_${res.status}`, fetchedAt };
    }
    const data = (await res.json()) as T;
    return { ok: true, status: 200, data, fetchedAt };
  } catch (e: any) {
    return { ok: false, status: 0, error: `network_${String(e?.message || e)}`, fetchedAt: Date.now() };
  }
}

export async function getBrregEnhetSafe(orgnr: string): Promise<BrregResult> {
  const mode = (process.env.BRREG_MODE || 'open').trim().toLowerCase();
  if (mode !== 'open') {
    // Autorisert modus kan implementeres her senere (Maskinporten)
    console.warn('[brreg.getBrregEnhetSafe] BRREG_MODE=', mode, '→ bruker åpent endepunkt');
  }
  return fetchOpen(orgnr);
}

export async function fetchBrregOrganization(orgnr: string): Promise<BrregOrgDetails | null> {
  if (!/^\d{9}$/.test(orgnr)) return null;

  if (isTruthyEnv(process.env.MOCK_BRREG)) {
    return {
      orgnr,
      name: 'Mockt organisasjon',
      org_form: 'AS',
      registered_at: new Date('2010-01-01').toISOString(),
      status_text: 'AKTIV',
      address: 'Storgata 1, 0001 Oslo',
      industry_code: '62.010',
      raw_json: { mock: true }
    };
  }

  try {
    const mode = (process.env.BRREG_MODE || 'open').toLowerCase();
    if (mode !== 'open') {
      // Vi har ikke autorisert-klient her – logg og bruk åpent endepunkt som fallback
      console.warn('[brreg.fetchOrganization] BRREG_MODE=', mode, '→ bruker åpent endepunkt (fallback)');
    }

    const res = await fetch(`https://data.brreg.no/enhetsregisteret/api/enheter/${orgnr}`, {
      headers: { accept: 'application/json' },
      cache: 'no-store'
    });
    if (!res.ok) return null;
    const data: any = await res.json();
    const navn = data?.navn ?? null;
    const orgForm = data?.organisasjonsform?.kode ?? null;
    const regdt = data?.registreringsdatoEnhetsregisteret || data?.registreringsdatoEnhetsregisteret?.dato || null;
    const slettet = data?.slettedato ?? data?.slettetDato;
    const status = slettet ? 'SLETTET' : 'AKTIV';
    const addrObj = data?.forretningsadresse || data?.forretningsAdresse || data?.beliggenhetsadresse;
    const addr = addrObj
      ? [
          Array.isArray(addrObj?.adresse) ? addrObj?.adresse.join(' ') : addrObj?.adresse,
          addrObj?.postnummer,
          addrObj?.poststed
        ]
          .filter(Boolean)
          .join(', ')
      : null;
    const nace = data?.naeringskode1?.kode ?? null;

    return {
      orgnr,
      name: navn,
      org_form: orgForm,
      registered_at: regdt ? new Date(regdt).toISOString() : null,
      status_text: status,
      address: addr,
      industry_code: nace,
      raw_json: data,
    };
  } catch (error) {
    console.error('[brreg.fetchOrganization]', error);
    return null;
  }
}

