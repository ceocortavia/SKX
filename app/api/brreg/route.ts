import { NextResponse } from "next/server";
import pool from "@/lib/db";

type BrregOrg = { orgnr: string; name: string; status: string };

function isTruthyEnv(value: string | undefined): boolean {
  if (!value) return false;
  const v = value.toLowerCase();
  return v === "1" || v === "true" || v === "yes";
}

async function fetchBrregOrgnr(orgnr: string): Promise<BrregOrg | null> {
  if (isTruthyEnv(process.env.MOCK_BRREG)) {
    return { orgnr, name: "Mockt organisasjon", status: "AKTIV" };
  }

  try {
    const res = await fetch(
      `https://data.brreg.no/enhetsregisteret/api/enheter/${orgnr}`,
      { headers: { accept: "application/json" }, cache: "no-store" }
    );
    if (!res.ok) return null;
    const data: any = await res.json();
    const navn = data?.navn ?? "Ukjent organisasjon";
    const slettet = data?.slettedato ?? data?.slettetDato;
    const status = slettet ? "SLETTET" : "AKTIV";
    return { orgnr, name: navn, status };
  } catch (err) {
    console.error("[brreg.fetchOrgnr]", err);
    return null;
  }
}

async function fetchBrregByName(nameQuery: string): Promise<BrregOrg[]> {
  if (isTruthyEnv(process.env.MOCK_BRREG)) {
    return [
      { orgnr: "999999999", name: `${nameQuery} AS`, status: "AKTIV" },
    ];
  }
  try {
    const url = `https://data.brreg.no/enhetsregisteret/api/enheter?navn=${encodeURIComponent(
      nameQuery
    )}&size=20`;
    const res = await fetch(url, {
      headers: { accept: "application/json" },
      cache: "no-store",
    });
    if (!res.ok) return [];
    const data: any = await res.json();
    const enheter: any[] = data?._embedded?.enheter ?? [];
    return enheter.map((e) => {
      const orgnr = String(e?.organisasjonsnummer ?? "");
      const navn = e?.navn ?? "";
      const slettet = e?.slettedato ?? e?.slettetDato;
      const status = slettet ? "SLETTET" : "AKTIV";
      return { orgnr, name: navn, status } as BrregOrg;
    }).filter((x) => x.orgnr.length === 9);
  } catch (err) {
    console.error("[brreg.fetchByName]", err);
    return [];
  }
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const qRaw = (searchParams.get("q") || "").trim();
  if (!qRaw) return NextResponse.json({ items: [] });

  const client = await pool.connect();
  try {
    if (/^\d{9}$/.test(qRaw)) {
      const cached = await client.query(
        `select orgnr, name, status from public.brreg_cache where orgnr=$1`,
        [qRaw]
      );
      if (cached.rows[0]) return NextResponse.json({ items: cached.rows });

      const fresh = await fetchBrregOrgnr(qRaw);
      if (!fresh) return NextResponse.json({ items: [] });
      const up = await client.query(
        `select (public.upsert_brreg_cache($1,$2,$3,$4,$5,$6,$7)).*`,
        [fresh.orgnr, fresh.name, null, null, null, null, fresh.status]
      );
      return NextResponse.json({ items: up.rows });
    }

    const q = `%${qRaw}%`;
    const rows = await client.query(
      `select orgnr, name, status from public.brreg_cache where name ilike $1 order by name asc limit 20`,
      [q]
    );
    if (rows.rows.length > 0) return NextResponse.json({ items: rows.rows });

    // Fallback til live-søk når cachen ikke har treff
    const freshList = await fetchBrregByName(qRaw);
    const upserted: BrregOrg[] = [];
    for (const item of freshList) {
      try {
        await client.query(
          `select (public.upsert_brreg_cache($1,$2,$3,$4,$5,$6,$7)).*`,
          [item.orgnr, item.name, null, null, null, null, item.status]
        );
        upserted.push(item);
      } catch (e) {
        console.error("[brreg.upsert]", e);
      }
    }
    return NextResponse.json({ items: upserted });
  } catch (err) {
    console.error("[brreg]", err);
    return NextResponse.json({ items: [] });
  } finally {
    client.release();
  }
}


