import { NextResponse } from "next/server";
import pool from "@/lib/db";
import { getAuthContext } from "@/lib/auth-context";
import { resolveOrgContext } from "@/lib/org-context";
import { withGUC } from "@/lib/withGUC";
import { executeAiRun } from "@/lib/ai/run";
import { generateInvitationCopy } from "@/lib/ai/invite";
import { hashInput } from "@/lib/ai/hash";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface CopyBody {
  role?: string;
  language?: "nb" | "en";
  tone?: "formal" | "friendly";
  orgContext?: {
    displayName?: string;
    mission?: string;
  };
}

export async function POST(req: Request) {
  let payload: CopyBody = {};
  try {
    payload = await req.json();
  } catch (_) {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const role = payload.role?.trim();
  const language = payload.language ?? "nb";
  const tone = payload.tone ?? "formal";

  if (!role) {
    return NextResponse.json({ error: "missing_role" }, { status: 400 });
  }

  if (!["nb", "en"].includes(language)) {
    return NextResponse.json({ error: "invalid_language" }, { status: 400 });
  }

  if (!["formal", "friendly"].includes(tone)) {
    return NextResponse.json({ error: "invalid_tone" }, { status: 400 });
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

      if (!mfaVerified) {
        return NextResponse.json({ error: "mfa_required" }, { status: 403 });
      }

      const response = await withGUC(client, {
        "request.clerk_user_id": clerkUserId,
        "request.user_id": userId,
        "request.org_id": org.id,
        "request.org_role": org.role,
        "request.org_status": org.status,
        "request.mfa": mfaVerified ? 'on' : 'off',
      }, async () => {
        const orgRes = await client.query<{ name: string | null }>(
          `select name from public.organizations where id = $1 limit 1`,
          [org.id]
        );
        const displayName = payload.orgContext?.displayName?.trim() || orgRes.rows[0]?.name || 'Organisasjonen din';
        const mission = payload.orgContext?.mission;

        const inputHash = hashInput({ role, language, tone, displayName, mission });
        const run = await executeAiRun(client, {
          orgId: org.id,
          feature: 'INVITE_COPY',
          createdBy: userId,
          inputHash,
        }, async () => {
          const generation = await generateInvitationCopy({
            orgDisplayName: displayName,
            role,
            language,
            tone,
            mission: mission ?? null,
          });

          return {
            data: generation.variants,
            tokensIn: generation.tokensIn,
            tokensOut: generation.tokensOut,
            modelVersion: generation.model,
          };
        });

        return {
          runId: run.runId,
          variants: run.result,
        };
      });

      return NextResponse.json({ variants: response.variants, runId: response.runId });
    } finally {
      client.release();
    }
  } catch (error) {
    console.error("[org.invitations.copy]", error);
    return NextResponse.json({ error: "internal_error" }, { status: 500 });
  }
}
