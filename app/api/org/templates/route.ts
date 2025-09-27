import { NextResponse } from "next/server";
import pool from "@/lib/db";
import { getAuthContext } from "@/lib/auth-context";
import { resolveOrgContext } from "@/lib/org-context";
import { withGUC } from "@/lib/withGUC";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface TemplateBody {
  type?: 'INVITE';
  locale?: string;
  subject?: string;
  body?: string;
  meta?: Record<string, unknown> | null;
}

export async function POST(req: Request) {
  let payload: TemplateBody = {};
  try {
    payload = await req.json();
  } catch (_) {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  if (payload.type !== 'INVITE') {
    return NextResponse.json({ error: "invalid_type" }, { status: 400 });
  }

  const locale = (payload.locale || 'nb').toLowerCase();
  const subject = payload.subject?.trim();
  const body = payload.body?.trim();

  if (!subject || subject.length < 3) {
    return NextResponse.json({ error: "invalid_subject" }, { status: 400 });
  }
  if (!body || body.length < 10) {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
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

      const meta = payload.meta ? JSON.stringify(payload.meta) : null;

      const result = await withGUC(client, {
        "request.clerk_user_id": clerkUserId,
        "request.user_id": userId,
        "request.org_id": org.id,
        "request.org_role": org.role,
        "request.org_status": org.status,
        "request.mfa": "on",
      }, async () => {
        const inserted = await client.query<{
          id: string;
        }>(
          `insert into public.content_templates (org_id, type, locale, subject, body, meta_json, created_by)
           values ($1, $2, $3, $4, $5, $6::jsonb, $7)
           returning id`,
          [org.id, 'INVITE', locale, subject, body, meta, userId]
        );
        return inserted.rows[0];
      });

      return NextResponse.json({ templateId: result.id });
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('[org.templates] error', error);
    return NextResponse.json({ error: "internal_error" }, { status: 500 });
  }
}

