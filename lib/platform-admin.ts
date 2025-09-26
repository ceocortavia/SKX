import type { PoolClient } from 'pg';
import { isQATestPlatformAdmin } from '@/server/authz';

export type PlatformRole = 'super_admin' | 'none';

export interface PlatformAdminContext {
  userId: string;
  email: string | null;
  role: PlatformRole;
  viaEnv: boolean;
  viaDb: boolean;
}

function getEnvSuperAdmins(): string[] {
  return (process.env.SUPER_ADMINS || '')
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
}

export function isEnvSuperAdmin(email: string | null | undefined): boolean {
  if (!email) return false;
  return getEnvSuperAdmins().includes(email.toLowerCase());
}

export async function resolvePlatformAdmin(
  client: PoolClient,
  clerkUserId: string,
  fallbackEmail: string | null | undefined = null
): Promise<PlatformAdminContext | null> {
  // QA short-circuit: dersom header signaliserer platform-admin, returner super_admin uten DB-krav
  try {
    if (isQATestPlatformAdmin()) {
      // Finn (eller fake) user for GUC. Vi forsøker å slå opp, men lar resten være best-effort.
      const res = await client.query<{ id: string }>(
        `select id from public.users where clerk_user_id = $1 limit 1`,
        [clerkUserId]
      );
      const userId = res.rows[0]?.id || '00000000-0000-4000-8000-000000000000';
      return { userId, email: fallbackEmail ?? null, role: 'super_admin', viaEnv: false, viaDb: true };
    }
  } catch {}
  const res = await client.query<{ id: string; primary_email: string | null }>(
    `select id, primary_email
       from public.users
      where clerk_user_id = $1
      limit 1`,
    [clerkUserId]
  );
  if (!res.rowCount) return null;

  const user = res.rows[0];
  const email = user.primary_email ?? fallbackEmail ?? null;
  const envHit = isEnvSuperAdmin(email);

  const dbRes = await client.query<{ is_super: boolean }>(
    `select true as is_super
       from public.platform_admins
      where user_id = $1
      limit 1`,
    [user.id]
  );
  const viaDb = !!dbRes.rowCount && dbRes.rowCount > 0;

  return {
    userId: user.id,
    email,
    role: envHit || viaDb ? 'super_admin' : 'none',
    viaEnv: envHit,
    viaDb,
  };
}

export function requirePlatformSuper(context: PlatformAdminContext | null) {
  if (!context || context.role !== 'super_admin') {
    const error = new Error('forbidden');
    (error as any).statusCode = 403;
    throw error;
  }
  return context;
}

export async function setPlatformRoleGUC(client: PoolClient, role: PlatformRole) {
  await client.query(`select set_config('request.platform_role', $1, true)`, [role === 'super_admin' ? 'super_admin' : '']);
}

export async function ensurePlatformRoleGUC(client: PoolClient, context: PlatformAdminContext | null) {
  await setPlatformRoleGUC(client, context?.role ?? 'none');
}

export async function listDbSuperAdmins(client: PoolClient) {
  const res = await client.query<{
    user_id: string;
    granted_by: string | null;
    granted_at: string;
    clerk_user_id: string | null;
    primary_email: string | null;
    full_name: string | null;
  }>(
    `select pa.user_id,
            pa.granted_by,
            pa.granted_at,
            u.clerk_user_id,
            u.primary_email,
            u.full_name
       from public.platform_admins pa
       join public.users u on u.id = pa.user_id
      order by pa.granted_at asc`
  );
  return res.rows;
}

export function listEnvSuperAdmins() {
  return getEnvSuperAdmins();
}
