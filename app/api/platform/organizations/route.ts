import { NextResponse } from "next/server";
import pool from "@/lib/db";
import { getAuthContext } from "@/lib/auth-context";
import { ensurePlatformRoleGUC, resolvePlatformAdmin, requirePlatformSuper } from "@/lib/platform-admin";
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
      const platformCtx = await resolvePlatformAdmin(client, auth.clerkUserId, auth.email);
      try {
        requirePlatformSuper(platformCtx);
      } catch (error: any) {
        const status = error?.statusCode ?? 403;
        return NextResponse.json({ ok: false, error: "forbidden" }, { status });
      }
      await ensurePlatformRoleGUC(client, platformCtx);

      const url = new URL(req.url);
      const search = url.searchParams.get("search")?.trim() ?? "";
      const limit = Math.min(Number(url.searchParams.get("limit") ?? 100), 200);

      const organizations = await withGUC(client, {
        "request.user_id": platformCtx!.userId,
        "request.clerk_user_id": auth.clerkUserId,
        "request.platform_role": "super_admin",
      }, async () => {
        const values: any[] = [];
        let where = "";
        if (search) {
          values.push(`%${search.toLowerCase()}%`);
          where = `where (lower(o.name) like $1 or o.orgnr like $1)`;
        }
        values.push(limit);
        const query = `
          select o.id, o.name, o.orgnr, o.status_text, o.homepage_domain,
                 o.registered_at, o.created_at, o.updated_at
            from public.organizations o
            ${where}
           order by o.name nulls last, o.created_at desc
           limit $${values.length}
        `;
        const result = await client.query(query, values);
        return result.rows;
      });

      return NextResponse.json({ ok: true, organizations });
    } finally {
      client.release();
    }
  } catch (error) {
    console.error("[platform.organizations]", error);
    return NextResponse.json({ ok: false, error: "internal_error" }, { status: 500 });
  }
}
