"use client";

import { useEffect, useMemo, useState } from "react";

interface SummaryItem {
  requirement_key: string;
  policy_version_id: string;
  title: string;
  version: number;
  policy_id: string;
  is_acked: boolean;
}

interface Props {
  caseId: string;
  policyMap?: Record<string, string>;
}

export function ToDoAttestPanel({ caseId, policyMap = {} }: Props) {
  const [items, setItems] = useState<SummaryItem[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [reading, setReading] = useState<{ title: string; body_md: string } | null>(null);
  const [summaryStatus, setSummaryStatus] = useState<string | undefined>(undefined);

  const requirementPolicyMap = useMemo(() => {
    if (items.length === 0) return policyMap;
    const map = { ...policyMap };
    for (const item of items) {
      if (!map[item.requirement_key] && item.policy_id) {
        map[item.requirement_key] = item.policy_id;
      }
    }
    return map;
  }, [items, policyMap]);

  async function load() {
    setLoading(true);
    setError(null);
    setSummaryStatus(undefined);
    try {
      const url = new URL("/api/org/compliance/summary", window.location.origin);
      url.searchParams.set("mine", "1");
      url.searchParams.set("caseId", caseId);
      const res = await fetch(url.toString(), { cache: "no-store" });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || "summary_failed");
      setSummaryStatus(json.status);
      setItems((json.details || []).filter((item: SummaryItem) => !item.is_acked));
    } catch (e: any) {
      setError(String(e?.message || e));
      setSummaryStatus(undefined);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [caseId]);

  async function viewPolicy(policyId: string) {
    setError(null);
    try {
      const res = await fetch(`/api/org/policies/${policyId}/latest`, { cache: "no-store" });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || "policy_not_found");
      setReading({ title: json.title || "Policy", body_md: json.body_md || "" });
    } catch (e: any) {
      setError(String(e?.message || e));
    }
  }

  async function attest(requirementKey: string) {
    const policyId = requirementPolicyMap[requirementKey];
    if (!policyId) {
      setError("policy_not_mapped");
      return;
    }
    setError(null);
    try {
      const res = await fetch(`/api/org/policies/${policyId}/ack`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ context: { caseId } }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || "ack_failed");
      await load();
    } catch (e: any) {
      setError(String(e?.message || e));
    }
  }

  return (
    <div className="space-y-3">
      <h3 className="font-medium">Attester før du starter</h3>
      {summaryStatus && (
        <span className="inline-block rounded bg-gray-100 px-2 py-1 text-xs uppercase tracking-wide text-gray-700">
          Status: {summaryStatus.replace(/_/g, " ")}
        </span>
      )}
      {loading && <div className="text-sm text-gray-500">Henter…</div>}
      {error && <div className="text-sm text-red-600">{error}</div>}
      {!loading && items.length === 0 && !error && (
        <div className="text-sm text-green-700">Ingen krav gjenstår. ✅</div>
      )}
      {items.length > 0 && (
        <ul className="space-y-2">
          {items.map((item) => (
            <li key={`${item.policy_version_id}-${item.requirement_key}`} className="flex flex-col gap-2 rounded border border-gray-200 bg-white p-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <div className="text-sm font-medium">{item.title} (v{item.version})</div>
                <div className="text-xs text-gray-500">{item.requirement_key}</div>
              </div>
              <div className="flex gap-2">
                <button className="rounded border px-3 py-1 text-sm" onClick={() => viewPolicy(requirementPolicyMap[item.requirement_key] || item.policy_id)}>
                  Vis
                </button>
                <button className="rounded bg-black px-3 py-1 text-sm text-white" onClick={() => attest(item.requirement_key)}>
                  Attester
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {reading && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={() => setReading(null)}
        >
          <div
            className="max-h-[80vh] w-full max-w-2xl overflow-y-auto rounded bg-white p-4 shadow-lg"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="mb-3 flex items-center justify-between">
              <h4 className="text-lg font-semibold">{reading.title}</h4>
              <button className="text-sm" onClick={() => setReading(null)}>
                Lukk
              </button>
            </div>
            <pre className="whitespace-pre-wrap text-sm text-gray-800">{reading.body_md}</pre>
          </div>
        </div>
      )}
    </div>
  );
}
