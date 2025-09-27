import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface IntentBody {
  query?: string;
}

interface CopilotIntent {
  type: string;
  params: Record<string, string | number | boolean | null>;
}

const INTENT_MATCHERS: Array<{
  test: (query: string) => boolean;
  intent: CopilotIntent;
  confirmText: string;
}> = [
  {
    test: (query) => /resend/i.test(query) && /invitasjon|invitation/i.test(query),
    intent: { type: 'RESEND_INVITATION', params: {} },
    confirmText: 'Vil du sende invitasjonen på nytt?'
  },
  {
    test: (query) => /brreg/i.test(query) && /(sync|oppdater|apply|hent)/i.test(query),
    intent: { type: 'RUN_BRREG_SUGGEST', params: {} },
    confirmText: 'Skal jeg hente forslag fra BRREG nå?'
  },
  {
    test: (query) => /bulk/i.test(query) && /approve|godkjenn/i.test(query),
    intent: { type: 'BULK_APPROVE_MEMBERS', params: {} },
    confirmText: 'Vil du godkjenne alle ventende medlemmer?'
  }
];

export async function POST(req: Request) {
  let payload: IntentBody = {};
  try {
    payload = await req.json();
  } catch (_) {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const query = payload.query?.trim();
  if (!query) {
    return NextResponse.json({ intent: null, confirmText: null });
  }

  const match = INTENT_MATCHERS.find((matcher) => matcher.test(query));
  if (!match) {
    return NextResponse.json({ intent: null, confirmText: null });
  }

  return NextResponse.json({ intent: match.intent, confirmText: match.confirmText });
}

