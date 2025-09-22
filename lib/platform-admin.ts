import type { PoolClient } from 'pg';

export function resolvePlatformRoleFromEmail(email: string | null | undefined): 'super_admin' | null {
  const list = (process.env.SUPER_ADMINS || '').split(',').map(s => s.trim().toLowerCase()).filter(Boolean);
  const hit = (email || '').toLowerCase();
  return list.includes(hit) ? 'super_admin' : null;
}

export async function setPlatformRoleGUC(client: PoolClient, role: 'super_admin' | null) {
  await client.query(`select set_config('request.platform_role', $1, true)`, [role ?? '']);
}

import type { PoolClient } from 'pg';

export type PlatformRole = 'super_admin' | 'none';

export interface PlatformAdminContext {
  userId: string;
  role: PlatformRole;
}

export async function resolvePlatformAdmin(
  client: PoolClient,
  clerkUserId: string
): Promise<PlatformAdminContext | null> {
  const res = await client.query<{
    id: string;
    is_super: boolean;
  }>(
    `select u.id, (pa.user_id is not null) as is_super
       from public.users u
       left join public.platform_admins pa on pa.user_id = u.id
      where u.clerk_user_id = $1
      limit 1`,
    [clerkUserId]
  );

  if (!res.rowCount) return null;

  const row = res.rows[0];
  return {
    userId: row.id,
    role: row.is_super ? 'super_admin' : 'none',
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
