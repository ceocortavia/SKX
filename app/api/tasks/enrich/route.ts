import { NextResponse } from "next/server";
import pool from "@/lib/db";
import { enrichOrganizationExternal } from "@/lib/enrichmentService";

export const runtime = "nodejs";

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const key = url.searchParams.get("key");
    const cronHeader = (req.headers.get('x-vercel-cron') ?? '').toLowerCase();
    const authorizedByHeader = cronHeader === '1' || cronHeader === 'true';
    const authorizedByKey = !!key && key === process.env.CRON_ENRICH_SECRET;
    if (!authorizedByHeader && !authorizedByKey) return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });

    const limit = Math.min(Number(url.searchParams.get("limit") || 50), 200);
    const client = await pool.connect();
    try {
      const r = await client.query<{ orgnr: string | null }>(
        `select orgnr
         from public.organizations
         where orgnr is not null
         order by coalesce(enriched_at, to_timestamp(0)) asc
         limit $1`,
        [limit]
      );

      const orgnrs = r.rows.map((row) => row.orgnr!).filter(Boolean);
      let success = 0;
      for (const o of orgnrs) {
        try {
          await enrichOrganizationExternal(o, client);
          success++;
        } catch (e) {
          console.error("[cron.enrich]", o, e);
        }
      }

      return NextResponse.json({ ok: true, processed: success });
    } finally {
      client.release();
    }
  } catch (err) {
    console.error("/api/tasks/enrich", err);
    return NextResponse.json({ ok: false, error: "internal_error" }, { status: 500 });
  }
}


