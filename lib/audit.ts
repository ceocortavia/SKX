import type { PoolClient } from "pg";

// Valgfri audit-logg. Forsøker å kalle en SECURITY DEFINER-funksjon hvis den finnes.
// Hvis den ikke finnes, svelger vi feilen (app skal ikke feile pga manglende audit).
export async function auditLog(
  client: PoolClient,
  params: {
    actorUserId: string;
    actorOrgId?: string | null;
    action: string;
    targetTable?: string | null;
    targetPk?: string | null;
    metadata?: Record<string, unknown> | null;
  }
) {
  try {
    await client.query(`select app.log_event($1,$2,$3,$4,$5,$6)`, [
      params.actorUserId,
      params.actorOrgId ?? null,
      params.action,
      params.targetTable ?? null,
      params.targetPk ?? null,
      params.metadata ? JSON.stringify(params.metadata) : null,
    ]);
  } catch {
    // no-op
  }
}


