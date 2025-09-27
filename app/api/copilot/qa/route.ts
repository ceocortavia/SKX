import { NextResponse } from "next/server";
import pool from "@/lib/db";
import { getAuthContext } from "@/lib/auth-context";
import { resolveOrgContext } from "@/lib/org-context";
import { withGUC } from "@/lib/withGUC";
import { executeAiRun } from "@/lib/ai/run";
import { callProvider } from "@/lib/ai/provider";
import { hashInput } from "@/lib/ai/hash";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface QaBody {
  query?: string;
  context?: {
    orgId?: string;
    correlationId?: string;
  };
}

interface KnowledgeDoc {
  id: string;
  scope: 'GLOBAL' | 'ORG';
  title: string;
  source: string | null;
  content: string | null;
}

function scoreDocument(doc: KnowledgeDoc, query: string): number {
  const haystack = `${doc.title ?? ''} ${doc.content ?? ''}`.toLowerCase();
  const terms = query.toLowerCase().split(/\s+/).filter(Boolean);
  if (!terms.length) return 0;
  let score = 0;
  terms.forEach((term) => {
    if (haystack.includes(term)) score += 1;
  });
  if (doc.scope === 'ORG') score += 0.5; // slight preference for org-local content
  return score;
}

function buildFallbackAnswer(query: string, docs: KnowledgeDoc[]): { answer: string; citations: Array<{ title: string; source: string | null }> } {
  if (!docs.length) {
    return {
      answer: `Fant ingen direkte treff i kunnskapsbasen for "${query}". Prøv å justere spørsmålet eller kontakt support om du står fast.`,
      citations: [],
    };
  }

  const lines = docs.map((doc) => `• ${doc.title}${doc.source ? ` (${doc.source})` : ''}`);
  const answer = [
    `Fant ${docs.length} relevante dokument${docs.length === 1 ? '' : 'er'}:`,
    ...lines,
    '',
    'Åpne dokumentene for detaljerte steg, eller be om en oppskrift.'
  ].join('\n');

  const citations = docs.map((doc) => ({ title: doc.title, source: doc.source }));

  return { answer, citations };
}

export async function POST(req: Request) {
  let payload: QaBody = {};
  try {
    payload = await req.json();
  } catch (_) {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const query = payload.query?.trim();
  if (!query) {
    return NextResponse.json({ error: "missing_query" }, { status: 400 });
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
      if (!userId) {
        return NextResponse.json({ error: "no_user" }, { status: 403 });
      }

      let activeOrg = org;
      const requestedOrgId = payload.context?.orgId;
      if (requestedOrgId && requestedOrgId !== org?.id) {
        const membershipRes = await client.query<{ organization_id: string; role: string; status: string }>(
          `select organization_id, role, status
             from public.memberships
            where user_id = $1 and organization_id = $2
            limit 1`,
          [userId, requestedOrgId]
        );
        const membership = membershipRes.rows[0];
        if (membership) {
          activeOrg = {
            id: membership.organization_id,
            role: membership.role,
            status: membership.status,
          };
        }
      }

      if (!activeOrg) {
        return NextResponse.json({ error: "no_org" }, { status: 403 });
      }

      const result = await withGUC(client, {
        "request.clerk_user_id": clerkUserId,
        "request.user_id": userId,
        "request.org_id": activeOrg.id,
        "request.org_role": activeOrg.role,
        "request.org_status": activeOrg.status,
        "request.mfa": mfaVerified ? 'on' : 'off'
      }, async () => {
        const docsRes = await client.query<KnowledgeDoc>(
          `select id, scope::text as scope, title, source, content
             from public.kb_docs
            where scope = 'GLOBAL' or (scope = 'ORG' and org_id = $1)
            order by updated_at desc
            limit 12`,
          [activeOrg.id]
        );
        const docs = docsRes.rows.map((row) => ({
          ...row,
          scope: row.scope === 'ORG' ? 'ORG' : 'GLOBAL'
        })) as KnowledgeDoc[];

        docs.sort((a, b) => scoreDocument(b, query) - scoreDocument(a, query));
        const topDocs = docs.slice(0, 3);

        const correlationId = payload.context?.correlationId?.trim();
        let auditNotes: string[] = [];
        if (correlationId) {
          const auditRes = await client.query<{ action: string; metadata: any; created_at: Date }>(
            `select action, metadata, created_at
               from public.audit_events
              where actor_org_id = $1
                and metadata ->> 'correlationId' = $2
              order by created_at desc
              limit 5`,
            [activeOrg.id, correlationId]
          );
          auditNotes = auditRes.rows.map((row) => `${row.action} – ${row.created_at.toISOString()}`);
        }

        const inputHash = hashInput({ query, docs: topDocs.map((d) => d.id), auditNotes });

        const run = await executeAiRun(client, {
          orgId: activeOrg.id,
          feature: 'COPILOT_QA',
          createdBy: userId,
          inputHash,
        }, async () => {
          if (!topDocs.length) {
            const fallback = buildFallbackAnswer(query, topDocs);
            return { data: fallback, tokensIn: 0, tokensOut: 0, modelVersion: 'fallback-local' };
          }

          const contextText = topDocs
            .map((doc, index) => `Doc ${index + 1}: ${doc.title}\nSource: ${doc.source ?? 'intern'}\nContent:\n${doc.content ?? ''}`)
            .join('\n\n');

          const auditText = auditNotes.length
            ? `\nRelevant hendelser:\n${auditNotes.join('\n')}`
            : '';

          const provider = await callProvider({
            systemPrompt: 'Du er en hjelpsom admin-copilot. Svar kort, med maks tre steg. Ikke finn på informasjon.',
            userPrompt: `Spørsmål: ${query}\n\nKunnskap:\n${contextText}${auditText}\n\nGi et svar basert på dokumentene. Returner JSON med answer og citations (med tittel og kilde).`,
            jsonSchema: {
              name: 'copilot_answer',
              schema: {
                type: 'object',
                required: ['answer', 'citations'],
                properties: {
                  answer: { type: 'string' },
                  citations: {
                    type: 'array',
                    items: {
                      type: 'object',
                      required: ['title', 'source'],
                      properties: {
                        title: { type: 'string' },
                        source: { type: 'string' }
                      }
                    }
                  }
                }
              }
            },
            temperature: 0.2,
          });

          if (provider) {
            try {
              const parsed = JSON.parse(provider.text ?? '{}');
              if (typeof parsed?.answer === 'string' && Array.isArray(parsed?.citations)) {
                return {
                  data: {
                    answer: parsed.answer,
                    citations: parsed.citations.map((item: any) => ({
                      title: String(item?.title ?? '').trim(),
                      source: String(item?.source ?? '').trim() || null,
                    })),
                  },
                  tokensIn: provider.tokensIn,
                  tokensOut: provider.tokensOut,
                  modelVersion: provider.model,
                };
              }
            } catch (err) {
              console.error('[copilot.qa.parse]', err);
            }
          }

          const fallback = buildFallbackAnswer(query, topDocs);
          return { data: fallback, tokensIn: provider?.tokensIn ?? 0, tokensOut: provider?.tokensOut ?? 0, modelVersion: provider?.model ?? 'fallback-local' };
        });

        return {
          runId: run.runId,
          answer: run.result.answer,
          citations: run.result.citations,
        };
      });

      return NextResponse.json({ answer: result.answer, citations: result.citations, runId: result.runId });
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('[copilot.qa] error', error);
    return NextResponse.json({ error: "internal_error" }, { status: 500 });
  }
}
