import { NextResponse } from "next/server";
import pool from "@/lib/db";
import { getAuthContext } from "@/lib/auth-context";
import { ensurePlatformRoleGUC, resolvePlatformAdmin, requirePlatformSuper } from "@/lib/platform-admin";
import { withGUC } from "@/lib/withGUC";
import { platformMemberUpdateSchema } from "@/lib/schemas";
import { z } from "zod";

export const runtime = "nodejs";

const querySchema = z.object({
  organizationId: z.string().uuid().optional(),
  limit: z.coerce.number().min(1).max(500).optional(),
});

export async function GET(req: Request) {
  try {
    const auth = await getAuthContext(req);
    if (!auth) {
      return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
    }

    const url = new URL(req.url);
    const parsedQuery = querySchema.safeParse({
      organizationId: url.searchParams.get("organizationId") ?? undefined,
      limit: url.searchParams.get("limit") ?? undefined,
    });
    if (!parsedQuery.success) {
      return NextResponse.json({ ok: false, error: "invalid_input", reason: "invalid_query" }, { status: 400 });
    }

    const { organizationId, limit = 200 } = parsedQuery.data;

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

      const members = await withGUC(client, {
        "request.user_id": platformCtx!.userId,
        "request.clerk_user_id": auth.clerkUserId,
        "request.platform_role": "super_admin",
      }, async () => {
        const values: any[] = [];
        let where = "";
        if (organizationId) {
          values.push(organizationId);
          where = "where m.organization_id = $1";
        }
        values.push(limit);
        const query = `
          select m.user_id,
                 m.organization_id,
                 m.role,
                 m.status,
                 m.created_at,
                 m.updated_at,
                 m.approved_at,
                 u.clerk_user_id,
                 u.primary_email,
                 u.full_name,
                 o.name as organization_name,
                 o.orgnr as organization_orgnr
            from public.memberships m
            join public.users u on u.id = m.user_id
            join public.organizations o on o.id = m.organization_id
            ${where}
           order by o.name nulls last, m.role desc, u.primary_email
           limit $${values.length}
        `;
        const result = await client.query(query, values);
        return result.rows;
      });

      return NextResponse.json({ ok: true, members });
    } finally {
      client.release();
    }
  } catch (error) {
    console.error("[platform.members.get]", error);
    return NextResponse.json({ ok: false, error: "internal_error" }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  try {
    const auth = await getAuthContext(req);
    if (!auth) {
      return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
    }

    let raw = "";
    try {
      raw = await req.text();
    } catch {
      return NextResponse.json({ ok: false, error: "invalid_json" }, { status: 400 });
    }

    let body: unknown;
    try {
      body = raw ? JSON.parse(raw) : {};
    } catch {
      return NextResponse.json({ ok: false, error: "invalid_json" }, { status: 400 });
    }

    const parsed = platformMemberUpdateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ ok: false, error: "invalid_input", reason: "invalid_payload" }, { status: 400 });
    }

    const { organizationId, userId, role, status } = parsed.data;
    if (role === undefined && status === undefined) {
      return NextResponse.json({ ok: false, error: "invalid_input", reason: "no_changes" }, { status: 400 });
    }

    const client = await pool.connect();
    try {
      const platformCtx = await resolvePlatformAdmin(client, auth.clerkUserId, auth.email);
      try {
        requirePlatformSuper(platformCtx);
      } catch (error: any) {
        const statusCode = error?.statusCode ?? 403;
        return NextResponse.json({ ok: false, error: "forbidden" }, { status: statusCode });
      }
      await ensurePlatformRoleGUC(client, platformCtx);

      const updated = await withGUC(client, {
        "request.user_id": platformCtx!.userId,
        "request.clerk_user_id": auth.clerkUserId,
        "request.platform_role": "super_admin",
      }, async () => {
        const result = await client.query(
          `update public.memberships m
              set role = coalesce($3::member_role, role),
                  status = coalesce($4::membership_status, status),
                  approved_at = case
                    when $4::membership_status = 'approved' and status <> 'approved' then now()
                    when $4::membership_status = 'pending' then null
                    when $4::membership_status is null then approved_at
                    else approved_at
                  end,
                  approved_by = case
                    when $4::membership_status = 'approved' and status <> 'approved' then $5::uuid
                    when $4::membership_status = 'pending' then null
                    else approved_by
                  end,
                  updated_at = now()
            where m.organization_id = $1::uuid and m.user_id = $2::uuid
            returning m.user_id,
                      m.organization_id,
                      m.role,
                      m.status,
                      m.created_at,
                      m.updated_at,
                      m.approved_at,
                      m.approved_by`,
          [organizationId, userId, role ?? null, status ?? null, platformCtx!.userId]
        );
        return result.rows[0] ?? null;
      });

      if (!updated) {
        return NextResponse.json({ ok: false, error: "not_found" }, { status: 404 });
      }

      return NextResponse.json({ ok: true, membership: updated });
    } finally {
      client.release();
    }
  } catch (error) {
    console.error("[platform.members.patch]", error);
    return NextResponse.json({ ok: false, error: "internal_error" }, { status: 500 });
  }
}
