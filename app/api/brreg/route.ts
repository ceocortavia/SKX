import { NextResponse } from "next/server";
import pool from "@/lib/db";

async function fetchBrregOrgnr(orgnr: string) {
  return { orgnr, name: "Ukjent organisasjon", status: "AKTIV" };
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
    return NextResponse.json({ items: rows.rows });
  } catch (err) {
    console.error("[brreg]", err);
    return NextResponse.json({ items: [] });
  } finally {
    client.release();
  }
}


