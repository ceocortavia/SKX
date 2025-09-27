import { NextResponse } from "next/server";
import pool from "@/lib/db";
import { getAuthContext } from "@/lib/auth-context";
import { resolveOrgContext } from "@/lib/org-context";
import { withGUC } from "@/lib/withGUC";
import { fetchBrregOrganization } from "@/lib/brreg";
import { generateBrregSuggestions } from "@/lib/ai/brregSuggest";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface SuggestBody {
  orgnr?: string;
}

export async function POST(req: Request) {
  let payload: SuggestBody = {};
  try {
    payload = await req.json();
  } catch (_) {
    payload = {};
  }

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

      const result = await withGUC(client, {
        "request.clerk_user_id": clerkUserId,
        "request.user_id": userId,
        "request.org_id": org.id,
        "request.org_role": org.role,
        "request.org_status": org.status,
        "request.mfa": mfaVerified ? "on" : "off",
      }, async () => {
        const orgRowRes = await client.query<{
          id: string;
          orgnr: string | null;
          name: string | null;
          org_form: string | null;
          status_text: string | null;
          address: string | null;
          industry_code: string | null;
          registered_at: Date | string | null;
          raw_brreg_json: any;
        }>(
          `select id, orgnr, name, org_form, status_text, address, industry_code, registered_at, raw_brreg_json
             from public.organizations
            where id = $1
            limit 1`,
          [org.id]
        );

        const orgRow = orgRowRes.rows[0];
        if (!orgRow) {
          return { diff: [], etag: null, runId: null } as const;
        }

        const orgnr = payload.orgnr && /^\d{9}$/.test(payload.orgnr)
          ? payload.orgnr
          : orgRow.orgnr;

        if (!orgnr || !/^\d{9}$/.test(orgnr)) {
          return { diff: [], etag: null, runId: null } as const;
        }

        const brreg = await fetchBrregOrganization(orgnr);
        if (!brreg) {
          return { diff: [], etag: null, runId: null } as const;
        }

        if (!brreg.raw_json && orgRow.raw_brreg_json) {
          brreg.raw_json = orgRow.raw_brreg_json;
        }

        const suggestions = await generateBrregSuggestions(client, {
          org: orgRow,
          brreg,
          orgId: org.id,
          createdBy: userId,
        });

        return suggestions;
      });

      if (!result.etag) {
        return NextResponse.json({ diff: [], etag: null, runId: result.runId });
      }

      return NextResponse.json(result);
    } finally {
      client.release();
    }
  } catch (error) {
    console.error("[org.brreg.suggest]", error);
    return NextResponse.json({ error: "internal_error" }, { status: 500 });
  }
}

