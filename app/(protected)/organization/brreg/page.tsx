import { headers, cookies } from "next/headers";
import { getBrregEnhetSafe } from "@/lib/brreg";
import { auth } from "@clerk/nextjs/server";
import pool from "@/lib/db";
import { withGUC } from "@/lib/withGUC";
import JsonViewer from "@/components/ui/JsonViewer";
import EnrichNowButton from "@/components/ui/EnrichNowButton";
import HomepageEditor from "@/components/ui/HomepageEditor";
import BrregSuggestionsSection from "@/components/organization/BrregSuggestionsSection";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const runtime = "nodejs";

type OrgDetails = {
  id: string;
  orgnr: string | null;
  name: string | null;
  org_form: string | null;
  registered_at: string | null;
  status_text: string | null;
  industry_code: string | null;
  address: string | null;
  ceo_name: string | null;
  revenue: number | null;
  revenue_latest: number | null;
  revenue_latest_year: number | null;
  profit_before_tax_latest: number | null;
  equity_latest: number | null;
  job_postings_active: number | null;
  job_postings_recent: number | null;
  job_tech_tags: string[] | null;
  has_public_contracts: boolean | null;
  public_contracts_count: number | null;
  public_contracts_sample: any;
  enriched_at: string | null;
  tech_stack?: { name: string; version: string | null; categories?: string[] }[] | null;
  raw_brreg_json: any;
} | null;

async function getDetails(): Promise<OrgDetails> {
  const { userId } = await auth();
  if (!userId) return null;

  const client = await pool.connect();
  try {
    // Finn intern user UUID
    const ures = await client.query<{ id: string }>(
      `select id from public.users where clerk_user_id=$1 limit 1`,
      [userId]
    );
    const userUuid = ures.rows[0]?.id;
    if (!userUuid) return null;

    // Finn valgt org fra user_org_selection, ellers fra cookie
    let orgId: string | null = await withGUC(client, { "request.user_id": userUuid }, async () => {
      const r = await client.query<{ id: string }>(
        `select o.id
         from public.user_org_selection uos
         join public.organizations o on o.id = uos.organization_id
         where uos.user_id = $1
         limit 1`,
        [userUuid]
      );
      return r.rows[0]?.id ?? null;
    });

    if (!orgId) {
      const jar = await cookies();
      orgId = jar.get("orgId")?.value || null;
    }
    if (!orgId) return null;

    // Finn membership for status
    const membership = await withGUC(client, { "request.user_id": userUuid, "request.org_id": orgId }, async () => {
      const r = await client.query<{ role: "owner"|"admin"|"member"; status: "approved"|"pending" }>(
        `select role, status from public.memberships where user_id=$1 and organization_id=$2 limit 1`,
        [userUuid, orgId]
      );
      return r.rows[0] ?? null;
    });

    // Hent detaljer under korrekt RLS-kontekst
    const orgRaw = await withGUC(client, {
      "request.user_id": userUuid,
      "request.org_id": orgId,
      "request.org_status": membership?.status ?? null
    } as any, async () => {
      const r = await client.query<NonNullable<OrgDetails>>(
        `select id, orgnr, name, org_form, registered_at, status_text, industry_code, address, ceo_name, revenue,
                revenue_latest, revenue_latest_year, profit_before_tax_latest, equity_latest,
                job_postings_active, job_postings_recent, job_tech_tags,
                has_public_contracts, public_contracts_count, public_contracts_sample, enriched_at,
                tech_stack,
                raw_brreg_json
         from public.organizations where id = $1 limit 1`,
        [orgId]
      );
      return (r.rows[0] as any) ?? null;
    });

    if (!orgRaw) return null;

    const registeredAtValue = (orgRaw as any).registered_at;
    const registeredAtString = registeredAtValue
      ? (registeredAtValue instanceof Date
          ? registeredAtValue.toISOString()
          : String(registeredAtValue))
      : null;

    const org: NonNullable<OrgDetails> = {
      id: (orgRaw as any).id,
      orgnr: (orgRaw as any).orgnr ?? null,
      name: (orgRaw as any).name ?? null,
      org_form: (orgRaw as any).org_form ?? null,
      registered_at: registeredAtString,
      status_text: (orgRaw as any).status_text ?? null,
      industry_code: (orgRaw as any).industry_code ?? null,
      address: (orgRaw as any).address ?? null,
      ceo_name: (orgRaw as any).ceo_name ?? null,
      revenue: (orgRaw as any).revenue ?? null,
      revenue_latest: (orgRaw as any).revenue_latest ?? null,
      revenue_latest_year: (orgRaw as any).revenue_latest_year ?? null,
      profit_before_tax_latest: (orgRaw as any).profit_before_tax_latest ?? null,
      equity_latest: (orgRaw as any).equity_latest ?? null,
      job_postings_active: (orgRaw as any).job_postings_active ?? null,
      job_postings_recent: (orgRaw as any).job_postings_recent ?? null,
      job_tech_tags: (orgRaw as any).job_tech_tags ?? null,
      has_public_contracts: (orgRaw as any).has_public_contracts ?? null,
      public_contracts_count: (orgRaw as any).public_contracts_count ?? null,
      public_contracts_sample: (orgRaw as any).public_contracts_sample ?? null,
      enriched_at: (orgRaw as any).enriched_at ? (new Date((orgRaw as any).enriched_at)).toISOString() : null,
      raw_brreg_json: (orgRaw as any).raw_brreg_json ?? null,
      tech_stack: (orgRaw as any).tech_stack ?? null,
    };

    return org;
  } finally {
    client.release();
  }
}

export default async function BrregPage(props: any) {
  const _h = headers(); const _c = await cookies();
  try {
    const org = await getDetails();
    console.log('BRREG page orgnr', org?.orgnr);
    const spRaw = props?.searchParams;
    const sp = spRaw && typeof spRaw.then === 'function' ? await spRaw : (spRaw || {});
    const queryOrgnr = (sp?.orgnr || '').replace(/\D/g, '');
    const orgnrClean = (queryOrgnr || org?.orgnr || '').replace(/\D/g, '');
    if (!orgnrClean || orgnrClean.length !== 9) {
      return (
        <div className="p-6">
          <h2 className="text-lg font-semibold">Mangler organisasjonsnummer</h2>
          <p className="text-sm text-muted-foreground">
            Velg/oppdater organisasjonen på profilsiden først. Du kan også teste med <code className="mx-1">?orgnr=920123456</code>.
          </p>
        </div>
      );
    }

    const safeRes = await getBrregEnhetSafe(orgnrClean);
    const liveBrreg = safeRes.ok ? safeRes.data ?? null : null;
    const storedBrreg = org?.raw_brreg_json ?? null;
    const br = liveBrreg ?? storedBrreg ?? null;

    if (!br && !safeRes.ok) {
      return (
        <div className="p-6">
          <h2 className="text-lg font-semibold">Kunne ikke laste BRREG</h2>
          <p className="text-sm text-muted-foreground">
            {`Status: ${safeRes.status || 'ukjent'}${safeRes.error ? ` (${safeRes.error})` : ''}`} — orgnr {orgnrClean}.
          </p>
          <p className="text-xs text-muted-foreground mt-2">
            Prøv igjen senere, eller oppdater fra BRREG i profil-siden.
          </p>
        </div>
      );
    }

    const brregStatusText = !safeRes.ok
      ? `Status: ${safeRes.status || 'ukjent'}${safeRes.error ? ` (${safeRes.error})` : ''}`
      : null;
    const fmtDate = (s: string | null) => s ? new Date(s).toLocaleDateString('nb-NO') : '—';
    const fmtText = (s: string | null) => s && s.trim() ? s : '—';
    const fmtNumber = (n: number | null) => typeof n === 'number' ? n.toLocaleString('nb-NO') : '—';
    const brregLink = br?.['_links']?.self?.href || (org?.orgnr ? `https://data.brreg.no/enhetsregisteret/api/enheter/${org.orgnr}` : null);
    const naceCode = br?.naeringskode1?.kode ?? org?.industry_code ?? null;
    const naceText = br?.naeringskode1?.beskrivelse ?? null;
    const kommune = br?.forretningsadresse?.kommune ?? null;
    const fylke = br?.forretningsadresse?.fylke ?? null;
    const antallAnsatte = typeof br?.antallAnsatte === 'number' ? br.antallAnsatte : null;
    const stiftetDato = br?.stiftelsesdato ?? null;
    const mva = !!br?.registrertIMvaregisteret;
    const konkurs = !!br?.konkurs;
    const avvikling = !!br?.underAvvikling;
    const slettetDato = br?.slettedato ?? br?.slettetDato ?? null;
    const parent = br?.morselskap || (br?.overordnetEnhet ? { organisasjonsnummer: br.overordnetEnhet } : null);
    const foretaksreg = !!br?.registrertIForetaksregisteret;
    const frivillighet = !!br?.registrertIFrivillighetsregisteret;
    const stiftelser = !!br?.registrertIStiftelsesregisteret;
    const arbeidsgiverreg = !!br?.registrertIArbeidsgiverregisteret;
    const tvangsavvikling = !!br?.underTvangsavviklingEllerTvangsopplosning;
    const sektorKode = br?.institusjonellSektorkode?.kode ?? null;
    const sektorTekst = br?.institusjonellSektorkode?.beskrivelse ?? null;
    const naeringskoder = [br?.naeringskode1, br?.naeringskode2, br?.naeringskode3].filter(Boolean) as any[];
    const tel = br?.telefon ?? br?.telefonnummer ?? null;
    const mail = br?.epost ?? br?.epostadresse ?? null;
    const web = br?.hjemmeside ?? br?.hjemmesideadresse ?? br?.internettside ?? null;
    const techs: any[] = Array.isArray((org as any)?.tech_stack) ? (org as any).tech_stack : [];
    const techByCategory: Record<string, { name: string; version: string | null }[]> = {};
    for (const t of techs) {
      const cats = Array.isArray((t as any)?.categories) && (t as any).categories.length ? (t as any).categories : ['Annet'];
      for (const c of cats) {
        techByCategory[c] = techByCategory[c] || [];
        techByCategory[c].push({ name: (t as any).name, version: (t as any).version ?? null });
      }
    }

    const fmtAddrObj = (a: any): string => {
      if (!a) return '—';
      const street = Array.isArray(a.adresse) ? a.adresse.join(' ') : (a.adresse || a.adresselinje1 || a.adresselinje2 || a.adresselinje3);
      const parts = [street, a.postnummer, a.poststed, a.land];
      return parts.filter((p) => !!(typeof p === 'string' ? p.trim() : p)).join(', ') || '—';
    };
    return (
    <div className="space-y-6">
      {!safeRes.ok && br ? (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          <div className="font-medium">Viser lagret BRREG-data</div>
          <p className="mt-1 text-xs sm:text-sm text-amber-800">
            {brregStatusText ?? 'Kunne ikke hente live-data fra BRREG akkurat nå.'} Dataen under er sist lagret i SKX. Prøv «Oppdater fra BRREG» senere.
          </p>
        </div>
      ) : null}
      <div className="rounded-2xl border border-gray-200 bg-white/70 backdrop-blur p-4 shadow-sm">
        <div className="text-sm font-medium">BRREG – Valgt organisasjon</div>
        {!org ? (
          <div className="text-sm text-gray-600 mt-1">Ingen valgt organisasjon.</div>
        ) : (
          <div className="mt-3 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <div>
              <div className="text-xs text-gray-500">Org.nr</div>
              <div className="font-mono">{fmtText(org.orgnr)}</div>
            </div>
            <div>
              <div className="text-xs text-gray-500">Navn</div>
              <div className="font-medium">{fmtText(org.name)}</div>
            </div>
            <div>
              <div className="text-xs text-gray-500">Organisasjonsform</div>
              <div>{fmtText(org.org_form)}</div>
            </div>
            <div>
              <div className="text-xs text-gray-500">Registrert</div>
              <div>{fmtDate(org.registered_at)}</div>
            </div>
            <div>
              <div className="text-xs text-gray-500">Status</div>
              <div className="flex flex-wrap items-center gap-2">
                <span>{fmtText(org.status_text)}</span>
                {mva ? <span className="rounded-full bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200 px-2 py-0.5 text-[10px]">MVA</span> : null}
                {konkurs ? <span className="rounded-full bg-red-50 text-red-700 ring-1 ring-red-200 px-2 py-0.5 text-[10px]">Konkurs</span> : null}
                {avvikling ? <span className="rounded-full bg-amber-50 text-amber-800 ring-1 ring-amber-200 px-2 py-0.5 text-[10px]">Under avvikling</span> : null}
                {slettetDato ? <span className="rounded-full bg-gray-50 text-gray-700 ring-1 ring-gray-200 px-2 py-0.5 text-[10px]">Slettet {fmtDate(String(slettetDato))}</span> : null}
              </div>
            </div>
            <div>
              <div className="text-xs text-gray-500">Næringskode</div>
              <div>{[naceCode, naceText].filter(Boolean).join(' — ') || '—'}</div>
            </div>
            <div>
              <div className="text-xs text-gray-500">Adresse</div>
              <div>{fmtText(org.address)}</div>
            </div>
            <div>
              <div className="text-xs text-gray-500">Daglig leder</div>
              <div>{fmtText(org.ceo_name)}</div>
            </div>
            <div>
              <div className="text-xs text-gray-500">Omsetning</div>
              <div>{org.revenue !== null ? `${fmtNumber(org.revenue)} NOK` : '—'}</div>
            </div>
            <div>
              <div className="text-xs text-gray-500">Kommune</div>
              <div>{fmtText(kommune)}</div>
            </div>
            <div>
              <div className="text-xs text-gray-500">Fylke</div>
              <div>{fmtText(fylke)}</div>
            </div>
            <div>
              <div className="text-xs text-gray-500">Antall ansatte</div>
              <div>{typeof antallAnsatte === 'number' ? fmtNumber(antallAnsatte) : '—'}</div>
            </div>
            <div>
              <div className="text-xs text-gray-500">Stiftet</div>
              <div>{stiftetDato ? fmtDate(String(stiftetDato)) : '—'}</div>
            </div>
            <div className="lg:col-span-3 sm:col-span-2">
              <div className="text-xs text-gray-500">Morselskap</div>
              <div>{parent ? `${parent.organisasjonsnummer ?? ''} ${parent.navn ?? ''}`.trim() || parent : '—'}</div>
            </div>
          </div>
        )}
        <div className="mt-3 flex items-center gap-2">
          {brregLink ? (
            <a className="text-xs text-indigo-600 hover:underline" href={brregLink} target="_blank" rel="noreferrer">Åpne i BRREG</a>
          ) : null}
          <EnrichNowButton orgnr={org?.orgnr} className="ml-auto" />
        </div>
      </div>
      {org ? <BrregSuggestionsSection /> : null}
      {/* Teknologisk profil (Tech Stack) */}
      <div className="rounded-2xl border border-gray-200 bg-white/70 backdrop-blur p-4 shadow-sm">
        <div className="flex items-center justify-between">
          <div className="text-sm font-medium">Teknologisk profil</div>
          {org?.enriched_at ? <span className="text-xs text-gray-500">Oppdatert {new Date(org.enriched_at).toLocaleString('nb-NO')}</span> : null}
        </div>
        {org?.id ? (
          <div className="mt-2">
            <HomepageEditor organizationId={org.id} />
          </div>
        ) : null}
        {techs.length ? (
          <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {Object.entries(techByCategory).map(([cat, items]) => (
              <div key={cat} className="rounded-lg border border-gray-200 bg-white/60 p-2">
                <div className="text-xs text-gray-500 mb-1">{cat}</div>
                <div className="flex flex-wrap gap-2">
                  {items.map((t, i) => (
                    <span key={`${cat}-${i}`} className="rounded-full bg-fuchsia-50 text-fuchsia-700 ring-1 ring-fuchsia-200 px-2 py-0.5 text-[11px]">
                      {t.name}{t.version ? ` ${t.version}` : ''}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="mt-2 text-sm text-gray-500">Ingen data ennå. Bruk "Oppdater alt" for å hente.</div>
        )}
      </div>

      {/* Rik profilseksjon med ekstra felt direkte fra BRREG */}
      {br ? (
        <div className="rounded-2xl border border-gray-200 bg-white/70 backdrop-blur p-4 shadow-sm">
          <div className="text-sm font-medium">Detaljer fra BRREG</div>
          <div className="mt-3 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {/* Orgtype/kategori */}
            <div>
              <div className="text-xs text-gray-500">Organisasjonskategori</div>
              <div>{br.organisasjonsform?.beskrivelse ?? '—'}</div>
            </div>
            {/* Sektor/NACE-tekst */}
            <div>
              <div className="text-xs text-gray-500">Næringskode (tekst)</div>
              <div>{br.naeringskode1?.beskrivelse ?? '—'}</div>
            </div>
            {/* Kommune og fylke */}
            <div>
              <div className="text-xs text-gray-500">Kommune</div>
              <div>{br.forretningsadresse?.kommune ?? '—'}</div>
            </div>
            <div>
              <div className="text-xs text-gray-500">Fylke</div>
              <div>{br.forretningsadresse?.fylke ?? '—'}</div>
            </div>
            {/* Antall ansatte (hvis finnes) */}
            <div>
              <div className="text-xs text-gray-500">Antall ansatte</div>
              <div>{br.antallAnsatte ?? '—'}</div>
            </div>
            {/* Stiftelsesdato / stiftet */}
            <div>
              <div className="text-xs text-gray-500">Stiftet</div>
              <div>{br.stiftelsesdato ? new Date(br.stiftelsesdato).toLocaleDateString('nb-NO') : '—'}</div>
            </div>
            {/* Morselskap */}
            <div className="sm:col-span-2 lg:col-span-3">
              <div className="text-xs text-gray-500">Morselskap</div>
              <div>
                {parent ? (
                  parent.organisasjonsnummer ? (
                    <a
                      className="text-indigo-600 hover:underline"
                      href={`https://data.brreg.no/enhetsregisteret/api/enheter/${parent.organisasjonsnummer}`}
                      target="_blank"
                      rel="noreferrer"
                    >
                      {(parent.organisasjonsnummer ?? '') + ' ' + (parent.navn ?? '')}
                    </a>
                  ) : (String(parent))
                ) : '—'}
              </div>
            </div>

            {/* Sekundære næringskoder */}
            {naeringskoder.length > 1 ? (
              <div className="sm:col-span-2 lg:col-span-3">
                <div className="text-xs text-gray-500">Sekundære næringskoder</div>
                <div className="flex flex-wrap gap-2 mt-1">
                  {naeringskoder.slice(1).map((nk: any, idx: number) => (
                    <span key={idx} className="rounded-full bg-indigo-50 text-indigo-700 ring-1 ring-indigo-200 px-2 py-0.5 text-[11px]">
                      {[nk?.kode, nk?.beskrivelse].filter(Boolean).join(' — ')}
                    </span>
                  ))}
                </div>
              </div>
            ) : null}

            {/* Registreringer */}
            <div className="sm:col-span-2 lg:col-span-3">
              <div className="text-xs text-gray-500">Registreringer</div>
              <div className="mt-1 flex flex-wrap gap-2">
                {foretaksreg ? <span className="rounded-full bg-slate-50 text-slate-700 ring-1 ring-slate-200 px-2 py-0.5 text-[11px]">Foretaksregisteret</span> : null}
                {frivillighet ? <span className="rounded-full bg-slate-50 text-slate-700 ring-1 ring-slate-200 px-2 py-0.5 text-[11px]">Frivillighetsregisteret</span> : null}
                {stiftelser ? <span className="rounded-full bg-slate-50 text-slate-700 ring-1 ring-slate-200 px-2 py-0.5 text-[11px]">Stiftelsesregisteret</span> : null}
                {arbeidsgiverreg ? <span className="rounded-full bg-slate-50 text-slate-700 ring-1 ring-slate-200 px-2 py-0.5 text-[11px]">Arbeidsgiverregisteret</span> : null}
                {tvangsavvikling ? <span className="rounded-full bg-rose-50 text-rose-700 ring-1 ring-rose-200 px-2 py-0.5 text-[11px]">Tvangsavvikling</span> : null}
              </div>
            </div>

            {/* Kontakt */}
            <div>
              <div className="text-xs text-gray-500">Telefon</div>
              <div>{fmtText(tel)}</div>
            </div>
            <div>
              <div className="text-xs text-gray-500">E-post</div>
              <div>{fmtText(mail)}</div>
            </div>
            <div>
              <div className="text-xs text-gray-500">Nettside</div>
              <div>{web ? <a className="text-indigo-600 hover:underline" href={web} target="_blank" rel="noreferrer">{web}</a> : '—'}</div>
            </div>

            {/* Andre adresser */}
            <div>
              <div className="text-xs text-gray-500">Postadresse</div>
              <div>{fmtAddrObj(br?.postadresse)}</div>
            </div>
            <div>
              <div className="text-xs text-gray-500">Beliggenhetsadresse</div>
              <div>{fmtAddrObj(br?.beliggenhetsadresse)}</div>
            </div>

            {/* Institusjonell sektorkode */}
            <div>
              <div className="text-xs text-gray-500">Sektorkode</div>
              <div>{[sektorKode, sektorTekst].filter(Boolean).join(' — ') || '—'}</div>
            </div>
          </div>
        </div>
      ) : null}

      {/* Økonomi (Regnskapsregisteret) */}
      <div className="rounded-2xl border border-gray-200 bg-white/70 backdrop-blur p-4 shadow-sm">
        <div className="flex items-center justify-between">
          <div className="text-sm font-medium">Økonomi (Regnskapsregisteret)</div>
          <div className="text-xs text-gray-500">{org?.revenue_latest_year ? `Siste år: ${org.revenue_latest_year}` : 'Siste år: —'}</div>
        </div>
        <div className="mt-3 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <div className="text-xs text-gray-500">Driftsinntekter</div>
            <div>{org?.revenue_latest != null ? `${fmtNumber(org.revenue_latest)} NOK` : '—'}</div>
          </div>
          <div>
            <div className="text-xs text-gray-500">Resultat før skatt</div>
            <div>{org?.profit_before_tax_latest != null ? `${fmtNumber(org.profit_before_tax_latest)} NOK` : '—'}</div>
          </div>
          <div>
            <div className="text-xs text-gray-500">Egenkapital</div>
            <div>{org?.equity_latest != null ? `${fmtNumber(org.equity_latest)} NOK` : '—'}</div>
          </div>
          <div>
            <div className="text-xs text-gray-500">Oppdatert</div>
            <div>{org?.enriched_at ? new Date(org.enriched_at).toLocaleString('nb-NO') : '—'}</div>
          </div>
        </div>
      </div>

      {/* Stillinger (NAV Arbeidsplassen) */}
      <div className="rounded-2xl border border-gray-200 bg-white/70 backdrop-blur p-4 shadow-sm">
        <div className="text-sm font-medium">Stillinger (NAV)</div>
        <div className="mt-3 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <div className="text-xs text-gray-500">Aktive annonser</div>
            <div>{org?.job_postings_active != null ? fmtNumber(org.job_postings_active) : '—'}</div>
          </div>
          <div>
            <div className="text-xs text-gray-500">Siste 30 dager</div>
            <div>{org?.job_postings_recent != null ? fmtNumber(org.job_postings_recent) : '—'}</div>
          </div>
          <div className="lg:col-span-2">
            <div className="text-xs text-gray-500">Teknologi‑stikkord</div>
            <div className="mt-1 flex flex-wrap gap-2">
              {org?.job_tech_tags?.length ? org.job_tech_tags.map((t, i) => (
                <span key={i} className="rounded-full bg-indigo-50 text-indigo-700 ring-1 ring-indigo-200 px-2 py-0.5 text-[11px]">{t}</span>
              )) : <span className="text-gray-500">—</span>}
            </div>
          </div>
        </div>
      </div>

      {/* Offentlige kontrakter (Doffin) */}
      <div className="rounded-2xl border border-gray-200 bg-white/70 backdrop-blur p-4 shadow-sm">
        <div className="flex items-center justify-between">
          <div className="text-sm font-medium">Offentlige kontrakter (Doffin)</div>
          {org?.has_public_contracts ? (
            <span className="rounded-full bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200 px-2 py-0.5 text-[10px]">Har kontrakter</span>
          ) : (
            <span className="text-xs text-gray-500">Ingen registrerte</span>
          )}
        </div>
        <div className="mt-3 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <div>
            <div className="text-xs text-gray-500">Antall tildelinger</div>
            <div>{org?.public_contracts_count != null ? fmtNumber(org.public_contracts_count) : '—'}</div>
          </div>
          <div className="sm:col-span-2 lg:col-span-2">
            <div className="text-xs text-gray-500">Eksempler</div>
            <div className="mt-1 space-y-2">
              {Array.isArray(org?.public_contracts_sample) && org.public_contracts_sample.length > 0 ? (
                org.public_contracts_sample.slice(0,5).map((c: any, i: number) => (
                  <div key={i} className="rounded-lg border border-gray-200 bg-white/60 p-2 text-sm">
                    <div className="font-medium truncate">{c?.title ?? 'Uten tittel'}</div>
                    <div className="text-xs text-gray-500">{c?.buyer ?? '—'}{c?.value ? ` · ${c.value}` : ''}</div>
                    {c?.url ? <a className="text-xs text-indigo-600 hover:underline" href={c.url} target="_blank" rel="noreferrer">Åpne</a> : null}
                  </div>
                ))
              ) : (
                <div className="text-sm text-gray-500">—</div>
              )}
            </div>
          </div>
        </div>
      </div>
      <div className="rounded-2xl border border-gray-200 bg-white/70 backdrop-blur p-4 shadow-sm">
        <div className="text-sm font-medium">Rådata fra BRREG</div>
        {!br ? (
          <div className="text-sm text-gray-600 mt-1">Ingen rådata tilgjengelig.</div>
        ) : (
          <div className="mt-3">
            <JsonViewer data={br} maxHeight="65vh" defaultExpandedLevel={2} />
          </div>
        )}
      </div>
    </div>
    );
  } catch (e: any) {
    console.error('BRREG page error', { msg: e?.message, stack: e?.stack });
    return (
      <div className="p-6">
        <h2 className="text-lg font-semibold">Kunne ikke laste BRREG</h2>
        <p className="text-sm text-muted-foreground">Prøv igjen senere, eller oppdater fra BRREG i profil-siden.</p>
      </div>
    );
  }
}
