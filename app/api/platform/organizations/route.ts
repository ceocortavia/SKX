import { NextResponse } from "next/server";
import { headers } from "next/headers";
import pool from "@/lib/db";
import { getAuthContext } from "@/lib/auth-context";
import { ensurePlatformRoleGUC, resolvePlatformAdmin } from "@/lib/platform-admin";
import { isQATestPlatformAdmin, isQATestBypass } from "@/server/authz";

function toHeadersSync(x: any): Headers {
  if (x && typeof x.get === 'function') return x as Headers;
  try {
    const h: any = typeof headers === 'function' ? (headers() as any) : (headers as any);
    if (h && typeof h.then === 'function') return new Headers();
    if (h && typeof h[Symbol.iterator] === 'function') return new Headers(Object.fromEntries(h as any));
    if (h && typeof h.get === 'function') return h as Headers;
  } catch {}
  return new Headers();
}
import { withGUC } from "@/lib/withGUC";

export const runtime = "nodejs";

export async function GET(req: Request) {
  try {
    const auth = await getAuthContext(req);
    if (!auth) {
      return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
    }

    const client = await pool.connect();
    try {
      let platformCtx = null as any;
      const hh = toHeadersSync(headers());
      if (isQATestBypass(hh)) {
        if (!isQATestPlatformAdmin(hh)) {
          return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });
        }
        // QA admin path
        const email = auth.email || hh.get('x-test-clerk-email') || null;
        const clerkId = auth.clerkUserId || hh.get('x-test-clerk-user-id') || 'qa_user';
        // Sørg for at det finnes en user i DB for GUC-bruk
        const up = await client.query<{ id: string }>(
          `insert into public.users (clerk_user_id, primary_email, full_name)
           values ($1,$2,$3)
           on conflict (clerk_user_id) do update set primary_email = coalesce(public.users.primary_email, excluded.primary_email)
           returning id`,
          [clerkId, email, 'QA Admin']
        );
        const userId = up.rows[0]?.id ?? (await client.query<{ id: string }>(`select id from public.users where clerk_user_id=$1 limit 1`, [clerkId])).rows[0]?.id;
        platformCtx = { userId, email, role: 'super_admin', viaEnv: false, viaDb: true };
        // Sett nødvendige GUC eksplisitt
        await client.query(`select set_config('request.user_id',$1,true)`, [userId]);
        await client.query(`select set_config('request.platform_role','super_admin',true)`);
      } else {
        platformCtx = await resolvePlatformAdmin(client, auth.clerkUserId, auth.email);
        if (!platformCtx || platformCtx.role !== 'super_admin') {
          return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });
        }
        await ensurePlatformRoleGUC(client, platformCtx);
      }

      const url = new URL(req.url);
      const search = url.searchParams.get("search")?.trim() ?? "";
      const techParam = url.searchParams.get("tech")?.trim() ?? ""; // comma-sep, case-insensitive
      const csv = url.searchParams.get("csv") === "1";
      const limit = Math.min(Number(url.searchParams.get("limit") ?? 100), 200);

      const organizations = await withGUC(client, {
        "request.user_id": platformCtx.userId,
        "request.clerk_user_id": auth.clerkUserId,
        "request.platform_role": "super_admin",
      }, async () => {
        const values: any[] = [];
        let whereClauses: string[] = [];

        if (search) {
          values.push(`%${search.toLowerCase()}%`);
          whereClauses.push(`(lower(o.name) like $${values.length} or o.orgnr like $${values.length})`);
        }

        // Build OR logic over provided tech tokens; match by technology name or category
        const techTokens = techParam
          .split(",")
          .map((t) => t.trim().toLowerCase())
          .filter((t) => t.length > 0);

        if (techTokens.length > 0) {
          const tokenConds: string[] = [];
          for (const tok of techTokens) {
            values.push(`%${tok}%`);
            const nameIdx = values.length;
            values.push(`%${tok}%`);
            const catIdx = values.length;
            tokenConds.push(`exists (
              select 1 from jsonb_array_elements(coalesce(o.tech_stack, '[]'::jsonb)) as e
              where (
                lower(coalesce(e->>'name','')) like $${nameIdx}
                or exists (
                  select 1 from jsonb_array_elements_text(coalesce(e->'categories', '[]'::jsonb)) c
                  where lower(c) like $${catIdx}
                )
              )
            )`);
          }
          whereClauses.push(`(${tokenConds.join(" or ")})`);
        }

        const where = whereClauses.length ? `where ${whereClauses.join(" and ")}` : "";

        if (csv) {
          const csvValues = [...values];
          // aggregate tech names as pipe-separated
          const csvQuery = `
            with base as (
              select o.id, o.name, o.orgnr, o.homepage_domain, o.updated_at, o.tech_stack
              from public.organizations o
              ${where}
              order by o.name nulls last, o.created_at desc
              limit ${limit}
            ), expl as (
              select b.id,
                     coalesce(e->>'name','') as tech_name
              from base b
              left join lateral jsonb_array_elements(coalesce(b.tech_stack, '[]'::jsonb)) e on true
            ), agg as (
              select b.id,
                     b.name,
                     b.orgnr,
                     b.homepage_domain,
                     b.updated_at,
                     string_agg(distinct nullif(expl.tech_name,''), ' | ') as tech_names
              from base b
              left join expl on expl.id = b.id
              group by b.id, b.name, b.orgnr, b.homepage_domain, b.updated_at
            )
            select * from agg
          `;
          const result = await client.query(csvQuery, csvValues);
          // Build CSV text
          const header = ['id','name','orgnr','homepage_domain','updated_at','tech_names'];
          const lines = [header.join(',')];
          for (const row of result.rows as any[]) {
            const vals = [row.id, row.name ?? '', row.orgnr ?? '', row.homepage_domain ?? '', row.updated_at?.toISOString?.() ?? String(row.updated_at ?? ''), row.tech_names ?? ''];
            // naive CSV escape
            lines.push(vals.map((v) => {
              const s = String(v ?? '');
              return s.includes(',') || s.includes('"') || s.includes('\n') ? '"' + s.replace(/"/g,'""') + '"' : s;
            }).join(','));
          }
          const csvBody = lines.join('\n');
          return NextResponse.json({ ok: true, csv: csvBody });
        }

        values.push(limit);
        const query = `
          select o.id, o.name, o.orgnr, o.status_text, o.homepage_domain,
                 o.registered_at, o.created_at, o.updated_at,
                 o.tech_stack
            from public.organizations o
            ${where}
           order by o.name nulls last, o.created_at desc
           limit $${values.length}
        `;
        const result = await client.query(query, values);
        return result.rows;
      });

      // If csv flag, return as text/csv stream from the csv string returned above
      if ((organizations as any)?.csv) {
        const body = (organizations as any).csv as string;
        return new NextResponse(body, {
          status: 200,
          headers: {
            'content-type': 'text/csv; charset=utf-8',
            'cache-control': 'no-store',
            'content-disposition': 'attachment; filename="organizations.csv"'
          }
        });
      }

      return NextResponse.json({ ok: true, organizations });
    } finally {
      client.release();
    }
  } catch (error) {
    console.error("[platform.organizations]", error);
    return NextResponse.json({ ok: false, error: "internal_error" }, { status: 500 });
  }
}
