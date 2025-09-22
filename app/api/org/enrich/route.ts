import { NextResponse } from "next/server";
import pool from "@/lib/db";
import { getAuthContext } from "@/lib/auth-context";
import { withGUC } from "@/lib/withGUC";
import { enrichOrganizationData } from "@/lib/enrich";
import { enrichOrganizationExternal } from "@/lib/enrichmentService";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const auth = await getAuthContext(req);
    if (!auth) return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });

    const body = await req.json().catch(() => ({} as any));
    const orgnrInput: string | undefined = body?.orgnr;
    const organizationIdInput: string | undefined = body?.organization_id;

    const client = await pool.connect();
    try {
      // Finn orgnr: direkte fra input, fra organization_id, eller fra valgt organisasjon
      let orgnr: string | null = null;

      if (orgnrInput && /^\d{9}$/.test(orgnrInput)) {
        orgnr = orgnrInput;
      }

      if (!orgnr && organizationIdInput) {
        const r = await client.query<{ orgnr: string | null }>(
          `select orgnr from public.organizations where id = $1 limit 1`,
          [organizationIdInput]
        );
        orgnr = r.rows[0]?.orgnr ?? null;
      }

      if (!orgnr) {
        // Slå opp valgt organisasjon for brukeren via user_org_selection
        const ures = await client.query<{ id: string }>(
          `select id from public.users where clerk_user_id=$1 limit 1`,
          [auth.clerkUserId]
        );
        const userUuid = ures.rows[0]?.id;
        if (userUuid) {
          const sel = await withGUC(client, { "request.user_id": userUuid }, async () => {
            const r = await client.query<{ orgnr: string | null }>(
              `select o.orgnr
               from public.user_org_selection uos
               join public.organizations o on o.id = uos.organization_id
               where uos.user_id = $1
               limit 1`,
              [userUuid]
            );
            return r.rows[0] ?? null;
          });
          orgnr = sel?.orgnr ?? null;
        }
      }

      if (!orgnr || !/^\d{9}$/.test(orgnr)) {
        return NextResponse.json({ ok: false, error: "invalid_orgnr" }, { status: 400 });
      }

      await enrichOrganizationData(orgnr, client);
      // Kjør ekstern berikelse i bakgrunnen
      enrichOrganizationExternal(orgnr, client).catch((e) => console.error("[org.enrich.external]", e));

      // Returner en kondensert visning av feltene
      const details = await client.query(
        `select id, orgnr, name, org_form, registered_at, status_text, industry_code, address, ceo_name, revenue,
                revenue_latest, revenue_latest_year, profit_before_tax_latest, equity_latest,
                job_postings_active, job_postings_recent, job_tech_tags,
                has_public_contracts, public_contracts_count, public_contracts_sample, enriched_at
         from public.organizations where orgnr = $1`,
        [orgnr]
      );

      return NextResponse.json({ ok: true, organization: details.rows[0] ?? null });
    } finally {
      client.release();
    }
  } catch (err) {
    console.error("[org.enrich]", err);
    return NextResponse.json({ ok: false, error: "internal_error" }, { status: 500 });
  }
}



