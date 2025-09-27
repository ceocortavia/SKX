import { NextResponse } from "next/server";
import pool from "@/lib/db";
import { getAuthContext } from "@/lib/auth-context";
import {
  ensurePlatformRoleGUC,
  listDbSuperAdmins,
  listEnvSuperAdmins,
  requirePlatformSuper,
  resolvePlatformAdmin,
} from "@/lib/platform-admin";
import { withGUC } from "@/lib/withGUC";
import { z } from "zod";

export const runtime = "nodejs";

const upsertSchema = z.object({
  email: z.string().email(),
});

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

export async function GET(req: Request) {
  try {
    const auth = await getAuthContext(req);
    if (!auth) {
      return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
    }

    const client = await pool.connect();
    try {
      const ctx = await resolvePlatformAdmin(client, auth.clerkUserId, auth.email);
      if (!ctx || ctx.role !== 'super_admin') {
        return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });
      }
      await ensurePlatformRoleGUC(client, ctx);

      const [dbAdmins, envAdmins] = await Promise.all([
        withGUC(client, { "request.platform_role": "super_admin" }, () => listDbSuperAdmins(client)),
        Promise.resolve(listEnvSuperAdmins()),
      ]);

      const envSet = new Set(envAdmins);

      const admins: { source: "db"|"env"; userId: string | null; email: string | null; clerkUserId: string | null; fullName: string | null; grantedAt: string | null }[] = [];
      for (const row of dbAdmins) {
        admins.push({
          source: "db",
          userId: row.user_id,
          email: row.primary_email?.toLowerCase() ?? null,
          clerkUserId: row.clerk_user_id,
          fullName: row.full_name,
          grantedAt: row.granted_at,
        });
      }

      for (const email of envSet) {
        if (!admins.find((a) => a.email === email)) {
          admins.push({ source: "env", userId: null, email, clerkUserId: null, fullName: null, grantedAt: null });
        }
      }

      return NextResponse.json({ ok: true, admins });
    } finally {
      client.release();
    }
  } catch (error) {
    console.error("[platform.admins.get]", error);
    return NextResponse.json({ ok: false, error: "internal_error" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const auth = await getAuthContext(req);
    if (!auth) {
      return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
    }

    let payload: unknown;
    try {
      payload = await req.json();
    } catch {
      return NextResponse.json({ ok: false, error: "invalid_json" }, { status: 400 });
    }

    const parsed = upsertSchema.safeParse(payload);
    if (!parsed.success) {
      return NextResponse.json({ ok: false, error: "invalid_input", reason: "invalid_email" }, { status: 400 });
    }

    const email = normalizeEmail(parsed.data.email);

    const client = await pool.connect();
    try {
      const ctx = await resolvePlatformAdmin(client, auth.clerkUserId, auth.email);
      if (!ctx || ctx.role !== 'super_admin') {
        return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });
      }
      await ensurePlatformRoleGUC(client, ctx);

      const result = await withGUC(client, { "request.platform_role": "super_admin" }, async () => {
        const userRes = await client.query<{ id: string; primary_email: string | null }>(
          `select id, primary_email
             from public.users
            where lower(coalesce(primary_email, '')) = $1
            limit 1`,
          [email]
        );
        if (!userRes.rowCount) {
          return { ok: false as const, error: "not_found" as const };
        }
        const user = userRes.rows[0];
        const exists = await client.query(`select 1 from public.platform_admins where user_id = $1 limit 1`, [user.id]);
        if (exists.rowCount) {
          return { ok: false as const, error: "conflict" as const };
        }
        const ins = await client.query<{ user_id: string; granted_at: string }>(
          `insert into public.platform_admins (user_id, granted_by)
             values ($1, $2)
             returning user_id, granted_at`,
          [user.id, ctx.userId]
        );
        return { ok: true as const, userId: ins.rows[0].user_id, grantedAt: ins.rows[0].granted_at };
      });

      if (!result.ok) {
        const status = result.error === "not_found" ? 404 : 409;
        return NextResponse.json({ ok: false, error: result.error }, { status });
      }

      return NextResponse.json({ ok: true, userId: result.userId, grantedAt: result.grantedAt });
    } finally {
      client.release();
    }
  } catch (error) {
    console.error("[platform.admins.post]", error);
    return NextResponse.json({ ok: false, error: "internal_error" }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const auth = await getAuthContext(req);
    if (!auth) {
      return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
    }

    let payload: unknown;
    try {
      payload = await req.json();
    } catch {
      return NextResponse.json({ ok: false, error: "invalid_json" }, { status: 400 });
    }

    const parsed = upsertSchema.safeParse(payload);
    if (!parsed.success) {
      return NextResponse.json({ ok: false, error: "invalid_input", reason: "invalid_email" }, { status: 400 });
    }

    const email = normalizeEmail(parsed.data.email);

    const client = await pool.connect();
    try {
      const ctx = await resolvePlatformAdmin(client, auth.clerkUserId, auth.email);
      if (!ctx || ctx.role !== 'super_admin') {
        return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });
      }
      await ensurePlatformRoleGUC(client, ctx);

      const deleted = await withGUC(client, { "request.platform_role": "super_admin" }, async () => {
        const userRes = await client.query<{ id: string }>(
          `select id
             from public.users
            where lower(coalesce(primary_email, '')) = $1
            limit 1`,
          [email]
        );
        if (!userRes.rowCount) return { ok: false as const, error: "not_found" as const };
        const userId = userRes.rows[0].id;
        const res = await client.query(
          `delete from public.platform_admins where user_id = $1`,
          [userId]
        );
        if (!res.rowCount) return { ok: false as const, error: "not_found" as const };
        return { ok: true as const };
      });

      if (!deleted.ok) {
        const status = deleted.error === "not_found" ? 404 : 400;
        return NextResponse.json({ ok: false, error: deleted.error }, { status });
      }

      return NextResponse.json({ ok: true });
    } finally {
      client.release();
    }
  } catch (error) {
    console.error("[platform.admins.delete]", error);
    return NextResponse.json({ ok: false, error: "internal_error" }, { status: 500 });
  }
}
