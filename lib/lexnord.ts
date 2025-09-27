import type { PoolClient } from 'pg';
import { resolveOrgContext } from './org-context';

export const LEXNORD_ORGNR = '920123456';

export interface LexNordContext {
  userId: string;
  orgId: string;
  role: string;
  status: string;
}

export class ForbiddenError extends Error {
  status: number;
  constructor(message: string, status = 403) {
    super(message);
    this.status = status;
  }
}

export async function resolveLexNordContext(
  client: PoolClient,
  clerkUserId: string,
  req: Request
): Promise<LexNordContext> {
  const { userId, org } = await resolveOrgContext(client, clerkUserId, req);
  if (!org) {
    throw new ForbiddenError('No organization in context');
  }
  const orgRes = await client.query<{ orgnr: string | null }>(
    `select orgnr from public.organizations where id = $1 limit 1`,
    [org.id]
  );
  const orgnr = orgRes.rows[0]?.orgnr;
  if (!orgnr || orgnr !== LEXNORD_ORGNR) {
    throw new ForbiddenError('LexNord organization required');
  }
  if (org.status !== 'approved') {
    throw new ForbiddenError('Organization not approved');
  }
  return {
    userId,
    orgId: org.id,
    role: org.role,
    status: org.status,
  };
}

export function isLexNordAdmin(context: LexNordContext): boolean {
  return context.role === 'owner' || context.role === 'admin';
}

