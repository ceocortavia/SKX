import type { PoolClient } from 'pg';
import { getTechStack } from './techStackService';

type Accounting = {
  revenue_latest: number | null;
  revenue_latest_year: number | null;
  profit_before_tax_latest: number | null;
  equity_latest: number | null;
};

type Jobs = {
  job_postings_active: number | null;
  job_postings_recent: number | null;
  job_tech_tags: string[] | null;
};

type PublicContracts = {
  has_public_contracts: boolean | null;
  public_contracts_count: number | null;
  public_contracts_sample: any[] | null;
};

type ExternalEnrichment = Accounting & Jobs & PublicContracts;

function safeNumber(x: any): number | null {
  const n = typeof x === 'string' ? Number(x) : x;
  return Number.isFinite(n) ? n : null;
}

async function fetchAccounting(orgnr: string): Promise<Accounting> {
  try {
    const res = await fetch(`https://data.brreg.no/regnskapsregisteret/regnskap/${orgnr}`, {
      headers: { accept: 'application/json' },
      cache: 'no-store'
    });
    if (!res.ok) return { revenue_latest: null, revenue_latest_year: null, profit_before_tax_latest: null, equity_latest: null };
    const data: any = await res.json();
    const reports: any[] = Array.isArray(data?.regnskap) ? data.regnskap : Array.isArray(data) ? data : [];
    const latest = reports
      .map((r: any) => ({ year: r?.regnskapsår ?? r?.aar ?? r?.år, doc: r }))
      .filter((r) => Number.isFinite(Number(r.year)))
      .sort((a, b) => Number(b.year) - Number(a.year))[0]?.doc;
    if (!latest) return { revenue_latest: null, revenue_latest_year: null, profit_before_tax_latest: null, equity_latest: null };
    const rev = latest?.resultatregnskapResultat?.sumDriftsinntekter || latest?.resultatregnskap?.sumDriftsinntekter || latest?.driftsinntekter;
    const pbt = latest?.resultatregnskapResultat?.resultatForSkatt || latest?.resultatForSkatt;
    const eq = latest?.balanse?.egenkapital || latest?.egenkapital;
    const year = latest?.regnskapsår ?? latest?.aar ?? latest?.år ?? null;
    return {
      revenue_latest: safeNumber(rev),
      revenue_latest_year: safeNumber(year),
      profit_before_tax_latest: safeNumber(pbt),
      equity_latest: safeNumber(eq),
    };
  } catch {
    return { revenue_latest: null, revenue_latest_year: null, profit_before_tax_latest: null, equity_latest: null };
  }
}

function extractTechTags(text: string): string[] {
  const tags = [
    'react','vue','angular','svelte','node','deno','bun','typescript','javascript','python','java','kotlin','c#','dotnet','go','golang','rust','ruby','php','laravel','rails','spring','nestjs','express','django','flask','fastapi','graphql','kubernetes','docker','helm','terraform','ansible','pulumi','aws','azure','gcp','postgres','mysql','mssql','mongodb','redis','kafka','rabbitmq','elasticsearch','snowflake','databricks','airflow','spark','hadoop'
  ];
  const lc = text.toLowerCase();
  const found = new Set<string>();
  for (const t of tags) if (lc.includes(t)) found.add(t);
  return Array.from(found).sort();
}

async function fetchJobs(orgnr: string): Promise<Jobs> {
  try {
    const res = await fetch(`https://arbeidsplassen.nav.no/public-feed/api/v1/ads?orgnr=${orgnr}`, { cache: 'no-store' });
    if (!res.ok) return { job_postings_active: null, job_postings_recent: null, job_tech_tags: null };
    const data: any = await res.json();
    const items: any[] = Array.isArray(data?.content) ? data.content : Array.isArray(data) ? data : [];
    const now = Date.now();
    const recent30 = items.filter((a) => {
      const d = new Date(a?.published ?? a?.created ?? a?.updated ?? 0).getTime();
      return now - d < 1000 * 60 * 60 * 24 * 30;
    });
    const tech = new Set<string>();
    for (const ad of items.slice(0, 50)) {
      const text = [ad?.title, ad?.description, ad?.employer?.description].filter(Boolean).join(' ');
      for (const t of extractTechTags(text)) tech.add(t);
    }
    return {
      job_postings_active: safeNumber(items.length),
      job_postings_recent: safeNumber(recent30.length),
      job_tech_tags: Array.from(tech).sort(),
    };
  } catch {
    return { job_postings_active: null, job_postings_recent: null, job_tech_tags: null };
  }
}

async function fetchPublicContracts(orgnr: string): Promise<PublicContracts> {
  try {
    // Merk: Doffin API varierer; vi forsøker et enkelt søk. Tilpass gjerne ved behov.
    const url = `https://www.doffin.no/api/public/1.0/search/notice?query=${encodeURIComponent(orgnr)}&take=25`;
    const res = await fetch(url, { cache: 'no-store' });
    if (!res.ok) return { has_public_contracts: null, public_contracts_count: null, public_contracts_sample: null };
    const data: any = await res.json();
    const items: any[] = Array.isArray(data?.items) ? data.items : Array.isArray(data) ? data : [];
    const awarded = items.filter((n: any) => (n?.noticeType || '').toLowerCase().includes('award'));
    const sample = awarded.slice(0, 5).map((n: any) => ({
      title: n?.title ?? n?.name ?? null,
      value: n?.estimatedValue ?? n?.awardValue ?? null,
      buyer: n?.buyer?.name ?? null,
      id: n?.id ?? null,
      published: n?.published ?? null,
      url: n?.url ?? null,
    }));
    return {
      has_public_contracts: awarded.length > 0,
      public_contracts_count: awarded.length,
      public_contracts_sample: sample,
    };
  } catch {
    return { has_public_contracts: null, public_contracts_count: null, public_contracts_sample: null };
  }
}

export async function enrichOrganizationExternal(orgnr: string, client: PoolClient): Promise<void> {
  const [acc, jobs, contracts] = await Promise.all([
    fetchAccounting(orgnr),
    fetchJobs(orgnr),
    fetchPublicContracts(orgnr),
  ]);

  // Finn domene for org (foretrinnsvis homepage_domain; fallback enkel heuristikk fra address)
  let domain: string | null = null;
  try {
    const d = await client.query<{ homepage_domain: string | null; address: string | null }>(
      `select homepage_domain, address from public.organizations where orgnr=$1 limit 1`,
      [orgnr]
    );
    domain = d.rows[0]?.homepage_domain ?? null;
    if (!domain) {
      const addr = d.rows[0]?.address ?? null;
      if (addr && /https?:\/\//i.test(addr)) {
        try { domain = new URL(addr).hostname; } catch {}
      }
    }
  } catch {}

  let techStack: any = null;
  if (domain) {
    techStack = await getTechStack(`https://${domain}`).catch(() => null);
  }

  await client.query(
    `update public.organizations set
      revenue_latest = coalesce($2, revenue_latest),
      revenue_latest_year = coalesce($3, revenue_latest_year),
      profit_before_tax_latest = coalesce($4, profit_before_tax_latest),
      equity_latest = coalesce($5, equity_latest),
      job_postings_active = coalesce($6, job_postings_active),
      job_postings_recent = coalesce($7, job_postings_recent),
      job_tech_tags = coalesce($8, job_tech_tags),
      has_public_contracts = coalesce($9, has_public_contracts),
      public_contracts_count = coalesce($10, public_contracts_count),
      public_contracts_sample = coalesce($11, public_contracts_sample),
      enriched_at = now(),
      tech_stack = coalesce($12, tech_stack)
     where orgnr = $1`,
    [
      orgnr,
      acc.revenue_latest,
      acc.revenue_latest_year,
      acc.profit_before_tax_latest,
      acc.equity_latest,
      jobs.job_postings_active,
      jobs.job_postings_recent,
      jobs.job_tech_tags ? (jobs.job_tech_tags as any) : null,
      contracts.has_public_contracts,
      contracts.public_contracts_count,
      contracts.public_contracts_sample ? JSON.stringify(contracts.public_contracts_sample) : null,
      techStack ? JSON.stringify(techStack) : null,
    ]
  );
}


