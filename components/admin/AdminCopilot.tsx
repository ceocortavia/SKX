'use client';

import { useState } from "react";
import CopyButton from "@/components/ui/CopyButton";

interface Citation {
  title: string;
  source: string | null;
}

interface QaResponse {
  answer: string;
  citations: Citation[];
  runId?: string;
}

interface IntentResponse {
  intent: {
    type: string;
    params: Record<string, unknown>;
  } | null;
  confirmText: string | null;
}

export default function AdminCopilot() {
  const [query, setQuery] = useState("");
  const [correlationId, setCorrelationId] = useState("");
  const [loading, setLoading] = useState(false);
  const [answer, setAnswer] = useState<string | null>(null);
  const [citations, setCitations] = useState<Citation[]>([]);
  const [runId, setRunId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [intent, setIntent] = useState<IntentResponse | null>(null);

  async function ask() {
    if (!query.trim()) {
      setError("Skriv inn et spørsmål først");
      return;
    }
    setLoading(true);
    setError(null);
    setIntent(null);
    try {
      const res = await fetch("/api/copilot/qa", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          query,
          context: correlationId ? { correlationId } : {},
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.error ?? "Copilot svarte ikke");
      }
      const data = (await res.json()) as QaResponse;
      setAnswer(data.answer ?? null);
      setCitations(Array.isArray(data.citations) ? data.citations : []);
      setRunId(data.runId ?? null);
    } catch (err: any) {
      setError(err?.message ?? "Ukjent feil");
      setAnswer(null);
      setCitations([]);
      setRunId(null);
    } finally {
      setLoading(false);
    }
  }

  async function resolveIntent() {
    if (!query.trim()) return;
    try {
      const res = await fetch("/api/copilot/intent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.error ?? "Ingen intens gjenkjent");
      }
      const data = (await res.json()) as IntentResponse;
      setIntent(data);
    } catch (err: any) {
      setError(err?.message ?? "Kunne ikke tolke intens");
    }
  }

  return (
    <div className="rounded-2xl border border-gray-200 bg-white/70 backdrop-blur p-4 shadow-sm space-y-4">
      <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
        <div className="w-full md:w-2/3">
          <label className="flex flex-col gap-2 text-sm">
            <span className="text-xs uppercase tracking-wide text-gray-500">Spørsmål</span>
            <textarea
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              rows={3}
              placeholder="Hvordan kjører jeg BRREG-sync?"
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
            />
          </label>
        </div>
        <div className="w-full md:w-1/3 flex flex-col gap-2">
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-xs uppercase tracking-wide text-gray-500">Korr-ID (valgfritt)</span>
            <input
              value={correlationId}
              onChange={(e) => setCorrelationId(e.target.value)}
              placeholder="e.g. req_123"
              className="rounded-lg border border-gray-200 px-2 py-1.5 text-sm"
            />
          </label>
          <div className="flex gap-2">
            <button
              onClick={ask}
              disabled={loading}
              className="flex-1 rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium hover:bg-gray-50 disabled:opacity-50"
            >
              {loading ? "Spør…" : "Spør Copilot"}
            </button>
            <button
              onClick={resolveIntent}
              className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm hover:bg-gray-50"
            >
              Finn handling
            </button>
          </div>
        </div>
      </div>

      {error && (
        <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>
      )}

      {answer && (
        <div className="rounded-xl border border-gray-200 bg-white px-4 py-3 shadow-sm space-y-2">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="text-xs uppercase tracking-wide text-gray-500">Svar</div>
              {runId ? <div className="text-[11px] text-gray-500">RunId: {runId}</div> : null}
            </div>
            <CopyButton value={answer} className="text-xs text-indigo-600">
              Kopier svar
            </CopyButton>
          </div>
          <p className="whitespace-pre-wrap text-sm text-gray-800">{answer}</p>
          {citations.length ? (
            <div className="rounded-lg bg-gray-50 px-3 py-2 text-xs text-gray-600">
              <div className="font-medium mb-1">Kilder</div>
              <ul className="list-disc pl-5 space-y-1">
                {citations.map((cite, idx) => (
                  <li key={idx}>
                    {cite.title}
                    {cite.source ? (
                      <span className="text-gray-500"> — {cite.source}</span>
                    ) : null}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      )}

      {intent?.intent && (
        <div className="rounded-xl border border-indigo-200 bg-indigo-50 px-4 py-3 text-sm text-indigo-900">
          <div className="font-medium">Foreslått handling</div>
          <div className="mt-1">Type: <span className="font-mono">{intent.intent.type}</span></div>
          {Object.keys(intent.intent.params || {}).length ? (
            <pre className="mt-2 whitespace-pre-wrap text-xs text-indigo-800">{JSON.stringify(intent.intent.params, null, 2)}</pre>
          ) : null}
          {intent.confirmText ? (
            <div className="mt-2 text-xs text-indigo-800">{intent.confirmText}</div>
          ) : null}
        </div>
      )}
    </div>
  );
}

