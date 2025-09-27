"use client";

import { useState } from "react";

interface SuggestionItem {
  field: string;
  current: string | null;
  suggested: string | null;
  confidence: number;
  reasoning: string;
}

interface SuggestResponse {
  diff: SuggestionItem[];
  etag: string | null;
  runId: string | null;
}

const FIELD_LABEL: Record<string, string> = {
  name: "Navn",
  org_form: "Organisasjonsform",
  status_text: "Status",
  address: "Adresse",
  industry_code: "NACE-kode",
  registered_at: "Registrert dato",
};

function formatValue(value: string | null): string {
  if (!value) return "—";
  if (/^\d{4}-\d{2}-\d{2}/.test(value)) {
    try {
      return new Date(value).toLocaleDateString("nb-NO");
    } catch {
      return value;
    }
  }
  return value;
}

export default function BrregSuggestionsSection() {
  const [loading, setLoading] = useState(false);
  const [applying, setApplying] = useState<string | null>(null);
  const [etag, setEtag] = useState<string | null>(null);
  const [suggestions, setSuggestions] = useState<SuggestionItem[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function fetchSuggestions() {
    setLoading(true);
    setError(null);
    setMessage(null);
    try {
      const res = await fetch("/api/org/brreg/suggest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.error ?? "Kunne ikke hente forslag");
      }
      const data = (await res.json()) as SuggestResponse;
      setSuggestions(Array.isArray(data.diff) ? data.diff : []);
      setEtag(data.etag ?? null);
      if ((data.diff ?? []).length === 0) {
        setMessage("Ingen endringer foreslått av BRREG");
      }
    } catch (err: any) {
      setError(err?.message ?? "Ukjent feil");
    } finally {
      setLoading(false);
    }
  }

  async function applySelection(payload: { accept?: Record<string, unknown>; threshold?: number }) {
    if (!etag) {
      setError("Ingen forslag å bruke");
      return;
    }
    setApplying(JSON.stringify(payload));
    setError(null);
    setMessage(null);
    try {
      const res = await fetch("/api/org/brreg/apply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ etag, ...payload }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.error ?? "Kunne ikke oppdatere organisasjonen");
      }
      const data = await res.json();
      const applied: string[] = Array.isArray(data?.applied) ? data.applied : [];
      if (!applied.length) {
        setMessage("Ingen felter ble oppdatert");
        return;
      }
      setSuggestions((prev) => prev.filter((item) => !applied.includes(item.field)));
      setMessage(`Oppdatert ${applied.length} felt`);
      if (applied.length === 0) {
        setEtag(null);
      }
    } catch (err: any) {
      setError(err?.message ?? "Oppdatering feilet");
    } finally {
      setApplying(null);
    }
  }

  async function applySingle(field: string, value: string | null) {
    await applySelection({ accept: { [field]: value } });
  }

  async function applyBulk() {
    await applySelection({ threshold: 0.85 });
  }

  return (
    <div className="rounded-2xl border border-gray-200 bg-white/70 backdrop-blur p-4 shadow-sm space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold">BRREG-forslag</h3>
          <p className="text-xs text-gray-500">Hent og vurder foreslåtte endringer før de lagres.</p>
        </div>
        <button
          className="inline-flex items-center rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium shadow-sm hover:bg-gray-50 disabled:opacity-50"
          onClick={fetchSuggestions}
          disabled={loading}
        >
          {loading ? "Henter…" : "Hent forslag"}
        </button>
      </div>

      {error && (
        <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>
      )}
      {message && (
        <div className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{message}</div>
      )}

      {suggestions.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs text-gray-500">{suggestions.length} forslag fra BRREG</span>
            <button
              className="text-xs font-medium text-indigo-600 hover:text-indigo-500 disabled:opacity-50"
              onClick={applyBulk}
              disabled={!!applying}
            >
              Bruk alle &gt; 85%
            </button>
          </div>

          <div className="space-y-3">
            {suggestions.map((item) => {
              const label = FIELD_LABEL[item.field] ?? item.field;
              const confidence = Math.round(item.confidence * 100);
              return (
                <div
                  key={item.field}
                  className="rounded-xl border border-gray-200 bg-white px-4 py-3 shadow-sm"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <div className="text-sm font-semibold">{label}</div>
                      <div className="text-xs text-gray-500">Sikkerhet: {confidence}%</div>
                    </div>
                    <button
                      className="text-xs font-medium text-indigo-600 hover:text-indigo-500 disabled:opacity-50"
                      onClick={() => applySingle(item.field, item.suggested)}
                      disabled={!!applying}
                    >
                      Bruk forslag
                    </button>
                  </div>
                  <dl className="mt-2 grid gap-2 sm:grid-cols-2 text-sm">
                    <div>
                      <dt className="text-xs uppercase tracking-wide text-gray-500">Nåværende</dt>
                      <dd className="font-medium text-gray-700">{formatValue(item.current)}</dd>
                    </div>
                    <div>
                      <dt className="text-xs uppercase tracking-wide text-gray-500">Forslag</dt>
                      <dd className="font-medium text-emerald-700">{formatValue(item.suggested)}</dd>
                    </div>
                  </dl>
                  <p className="mt-2 text-xs text-gray-500">{item.reasoning}</p>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
