import { NextResponse } from "next/server";
import pool from "@/lib/db";
import { getAuthContext } from "@/lib/auth-context";
import { resolveOrgContext } from "@/lib/org-context";
import { withGUC } from "@/lib/withGUC";
import { executeAiRun } from "@/lib/ai/run";
import { analyzeCsvMapping } from "@/lib/ai/csvMap";
import { hashInput } from "@/lib/ai/hash";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface CsvMapBody {
  headers?: string[];
  sampleRows?: Array<Record<string, string>>;
  fileName?: string;
}

export async function POST(req: Request) {
  let payload: CsvMapBody = {};
  try {
    payload = await req.json();
  } catch (_) {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const headers = Array.isArray(payload.headers) ? payload.headers.filter((h) => typeof h === 'string') : [];
  const sampleRows = Array.isArray(payload.sampleRows) ? payload.sampleRows : [];
  const fileName = typeof payload.fileName === 'string' ? payload.fileName : null;

  if (!headers.length) {
    return NextResponse.json({ error: "missing_headers" }, { status: 400 });
  }

  try {
    const authContext = await getAuthContext(req);
    if (!authContext) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }

    const { clerkUserId, mfaVerified } = authContext;

    if (!mfaVerified) {
      return NextResponse.json({ error: "mfa_required" }, { status: 403 });
    }

    const client = await pool.connect();
    try {
      const { userId, org } = await resolveOrgContext(client, clerkUserId, req);
      if (!userId || !org) {
        return NextResponse.json({ error: "no_org" }, { status: 403 });
      }

      if (!['admin', 'owner'].includes(org.role)) {
        return NextResponse.json({ error: "forbidden" }, { status: 403 });
      }

      const response = await withGUC(client, {
        "request.clerk_user_id": clerkUserId,
        "request.user_id": userId,
        "request.org_id": org.id,
        "request.org_role": org.role,
        "request.org_status": org.status,
        "request.mfa": mfaVerified ? 'on' : 'off',
      }, async () => {
        const inputHash = hashInput({ headers, sampleRows });
        const run = await executeAiRun(client, {
          orgId: org.id,
          feature: 'CSV_MAP',
          createdBy: userId,
          inputHash,
          modelVersion: 'heuristic-v1'
        }, async () => {
          const result = analyzeCsvMapping(headers, sampleRows ?? []);
          return { data: result, tokensIn: 0, tokensOut: 0, modelVersion: 'heuristic-v1' };
        });

        const status = run.result.issues.length ? 'DRAFT' : 'VALIDATED';
        const inserted = await client.query<{ id: string }>(
          `insert into public.csv_import_sessions (org_id, file_name, mapping_json, issues_json, sample_json, status, created_by)
           values ($1, $2, $3::jsonb, $4::jsonb, $5::jsonb, $6::csv_import_status, $7)
           returning id`,
          [
            org.id,
            fileName,
            JSON.stringify(run.result.mapping),
            JSON.stringify(run.result.issues),
            JSON.stringify(sampleRows ?? []),
            status,
            userId,
          ]
        );

        return {
          runId: run.runId,
          sessionId: inserted.rows[0].id,
          mapping: run.result.mapping,
          issues: run.result.issues,
          confidenceByField: run.result.confidenceByField,
        };
      });

      return NextResponse.json({
        mapping: response.mapping,
        issues: response.issues,
        confidenceByField: response.confidenceByField,
        sessionId: response.sessionId,
      });
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('[tools.csv-map]', error);
    return NextResponse.json({ error: "internal_error" }, { status: 500 });
  }
}
