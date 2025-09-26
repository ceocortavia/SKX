import pool from "@/lib/db";
import { getAuthContext } from "@/lib/auth-context";
import { resolveOrgContext } from "@/lib/org-context";
import { headers as nextHeaders } from 'next/headers';

export interface SessionContext {
  orgId: string;
  userId: string;
  clerkUserId: string;
  email: string;
  mfaVerified: boolean;
}

export class AuthError extends Error {
  status: number;
  constructor(message: string, status = 403) {
    super(message);
    this.status = status;
  }
}

function toHeadersSync(x: any): Headers {
  if (x && typeof x.get === 'function') return x as Headers;
  try {
    const h: any = (typeof nextHeaders === 'function') ? (nextHeaders() as any) : (nextHeaders as any);
    if (h && typeof h.then === 'function') return new Headers();
    if (h && typeof h[Symbol.iterator] === 'function') {
      return new Headers(Object.fromEntries(h as any));
    }
    if (h && typeof h.get === 'function') return h as Headers;
  } catch {}
  return new Headers();
}

function qaHeaders(h?: any): Headers {
  return toHeadersSync(h);
}

export function isQATestBypass(h?: any) {
  const hh = qaHeaders(h);
  const sec = process.env.TEST_BYPASS_SECRET || process.env.TEST_SEED_SECRET || '';
  return !!sec && hh.get('x-test-bypass') === '1' && hh.get('x-test-secret') === sec;
}

export function isQATestPlatformAdmin(h?: any) {
  const hh = qaHeaders(h);
  const role = (hh.get('x-test-role') || '').toLowerCase();
  return isQATestBypass(hh) && (role === 'platform-admin' || role.includes('platform'));
}

export async function getSession(req: Request): Promise<SessionContext> {
  const auth = await getAuthContext(req);
  if (!auth) {
    throw new AuthError("unauthorized", 401);
  }

  const client = await pool.connect();
  try {
    const { userId, org } = await resolveOrgContext(client, auth.clerkUserId, req);
    if (!org) {
      throw new AuthError("no_org", 403);
    }
    if (org.status !== "approved") {
      throw new AuthError("org_not_approved", 403);
    }
    return {
      orgId: org.id,
      userId,
      clerkUserId: auth.clerkUserId,
      email: auth.email,
      mfaVerified: auth.mfaVerified,
    };
  } finally {
    client.release();
  }
}

async function getMembership(userId: string, orgId: string) {
  const res = await pool.query<{ role: string; status: string }>(
    `select role, status from public.memberships where user_id = $1 and organization_id = $2 limit 1`,
    [userId, orgId]
  );
  return res.rows[0] ?? null;
}

export async function requireApprovedAdmin(userId: string, orgId: string) {
  if (isQATestBypass()) return;
  const membership = await getMembership(userId, orgId);
  if (!membership || membership.status !== "approved") {
    throw new AuthError("forbidden", 403);
  }
  if (!["admin", "owner"].includes(membership.role)) {
    throw new AuthError("forbidden", 403);
  }
}

export async function requireMember(userId: string, orgId: string) {
  if (isQATestBypass()) return;
  const membership = await getMembership(userId, orgId);
  if (!membership || membership.status !== "approved") {
    throw new AuthError("forbidden", 403);
  }
}

export async function requireApprovedAdminOrSelf(userId: string, orgId: string, targetUserId: string) {
  if (isQATestBypass()) return;
  const membership = await getMembership(userId, orgId);
  if (!membership || membership.status !== "approved") {
    throw new AuthError("forbidden", 403);
  }
  if (userId === targetUserId) return;
  if (!["admin", "owner"].includes(membership.role)) {
    throw new AuthError("forbidden", 403);
  }
}

