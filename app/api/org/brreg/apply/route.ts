import { NextResponse } from "next/server";
import pool from "@/lib/db";
import { getAuthContext } from "@/lib/auth-context";
import { resolveOrgContext } from "@/lib/org-context";
import { withGUC } from "@/lib/withGUC";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface ApplyBody {
  etag?: string;
  accept?: Record<string, unknown> | null;
  threshold?: number;
}

const FIELD_COLUMN_MAP: Record<string, string> = {
  name: "name",
  org_form: "org_form",
  status_text: "status_text",
  address: "address",
  industry_code: "industry_code",
  registered_at: "registered_at",
};

function toDate(value: unknown): Date | null {
  if (value instanceof Date) return value;
  if (typeof value === "string" || typeof value === "number") {
    const dt = new Date(value);
    if (!Number.isNaN(dt.getTime())) {
      return dt;
    }
  }
  return null;
}

export async function POST(req: Request) {
  let payload: ApplyBody = {};
  try {
    payload = await req.json();
  } catch (_) {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const etag = typeof payload.etag === "string" ? payload.etag.trim() : "";
  if (!etag) {
    return NextResponse.json({ error: "missing_etag" }, { status: 400 });
  }

  const threshold = typeof payload.threshold === "number" && !Number.isNaN(payload.threshold)
    ? Math.max(0, Math.min(1, payload.threshold))
    : 0.85;
  const acceptMap = payload.accept && typeof payload.accept === "object" ? payload.accept : {};
  const explicitFields = Object.keys(acceptMap);
  const applyAll = explicitFields.length === 0;

  try {
    const authContext = await getAuthContext(req);
    if (!authContext) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }

    const { clerkUserId, mfaVerified } = authContext;

    const client = await pool.connect();
    try {
      const { userId, org } = await resolveOrgContext(client, clerkUserId, req);
      if (!userId || !org) {
        return NextResponse.json({ error: "no_org" }, { status: 403 });
      }

      if (!['admin', 'owner'].includes(org.role)) {
        return NextResponse.json({ error: "forbidden" }, { status: 403 });
      }

      if (!mfaVerified) {
        return NextResponse.json({ error: "mfa_required" }, { status: 403 });
      }

      return await withGUC(client, {
        "request.clerk_user_id": clerkUserId,
        "request.user_id": userId,
        "request.org_id": org.id,
        "request.org_role": org.role,
        "request.org_status": org.status,
        "request.mfa": "on",
      }, async () => {
        const suggestionRes = await client.query<{
          id: string;
          diff_json: any;
        }>(
          `select id, diff_json
             from public.ai_suggestions
            where org_id = $1 and feature = 'BRREG_SUGGEST' and etag = $2
            limit 1`,
          [org.id, etag]
        );

        const suggestion = suggestionRes.rows[0];
        if (!suggestion) {
          return NextResponse.json({ error: "suggestion_not_found" }, { status: 404 });
        }

        const diffList = Array.isArray(suggestion.diff_json?.diff)
          ? suggestion.diff_json.diff as Array<{
              field: string;
              suggested: any;
              confidence: number;
            }>
          : [];

        if (!diffList.length) {
          return NextResponse.json({ error: "no_diff" }, { status: 400 });
        }

        const updates: Array<{ column: string; value: any; field: string }> = [];
        const appliedFields: string[] = [];
        const skipped: Array<{ field: string; reason: string }> = [];

        for (const item of diffList) {
          const column = FIELD_COLUMN_MAP[item.field];
          if (!column) {
            skipped.push({ field: item.field, reason: "unsupported_field" });
            continue;
          }

          if (!applyAll && !explicitFields.includes(item.field)) {
            skipped.push({ field: item.field, reason: "not_requested" });
            continue;
          }

          if (item.confidence < threshold) {
            skipped.push({ field: item.field, reason: "below_threshold" });
            continue;
          }

          const desiredValue = applyAll ? item.suggested : acceptMap[item.field];
          if (desiredValue === undefined) {
            skipped.push({ field: item.field, reason: "not_selected" });
            continue;
          }

          if (column === "registered_at") {
            const dt = toDate(desiredValue);
            if (!dt) {
              skipped.push({ field: item.field, reason: "invalid_date" });
              continue;
            }
            updates.push({ column, value: dt, field: item.field });
          } else if (desiredValue === null || desiredValue === undefined) {
            updates.push({ column, value: null, field: item.field });
          } else {
            updates.push({ column, value: String(desiredValue), field: item.field });
          }
          appliedFields.push(item.field);
        }

        if (!updates.length) {
          return NextResponse.json({ applied: [], skipped, profile: null });
        }

        const assignments: string[] = [];
        const values: any[] = [];
        updates.forEach((entry, index) => {
          assignments.push(`${entry.column} = $${index + 1}`);
          values.push(entry.value);
        });
        values.push(org.id);

        const updateQuery = `update public.organizations
                               set ${assignments.join(', ')},
                                   updated_at = now()
                             where id = $${values.length}
                         returning id, orgnr, name, org_form, status_text, address, industry_code, registered_at`;
        const updated = await client.query(updateQuery, values);
        const profile = updated.rows[0] ?? null;

        await client.query(
          `update public.ai_suggestions
              set applied_by = $1,
                  applied_at = now()
            where org_id = $2 and feature = 'BRREG_SUGGEST' and etag = $3`,
          [userId, org.id, etag]
        );

        await client.query(
          `insert into public.audit_events (actor_user_id, actor_org_id, action, target_table, target_pk, metadata)
           values ($1, $2, $3, $4, $5::uuid, $6::jsonb)`,
          [
            userId,
            org.id,
            'brreg_apply_suggestions',
            'organizations',
            org.id,
            JSON.stringify({ etag, applied: appliedFields, skipped }),
          ]
        );

        const normalizedProfile = profile
          ? {
              ...profile,
              registered_at: profile.registered_at ? new Date(profile.registered_at).toISOString() : null,
            }
          : null;

        return NextResponse.json({
          profile: normalizedProfile,
          applied: appliedFields,
          skipped,
        });
      });
    } finally {
      client.release();
    }
  } catch (error) {
    console.error("[org.brreg.apply]", error);
    return NextResponse.json({ error: "internal_error" }, { status: 500 });
  }
}

