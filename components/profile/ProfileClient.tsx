"use client";

import { useState, useEffect } from "react";
import useSWR from "swr";
import { jsonFetcher } from "@/lib/fetcher";
import { useRouter } from "next/navigation";

type BrregItem = { orgnr: string; name: string };

type ProfileContext = {
  organization: { id: string; orgnr: string | null; name: string | null } | null;
  membership: { role: "owner" | "admin" | "member"; status: "approved" | "pending" } | null;
  auth: { mfaVerified: boolean };
  permissions: {
    canInvite: boolean;
    canManageDomains: boolean;
    canBulkMembers: boolean;
    canBulkRole: boolean;
    readOnly: boolean;
  };
} | null;

export default function ProfileClient() {
  const router = useRouter();
  const { data, mutate } = useSWR<ProfileContext>("/api/profile/context", (url) => fetch(url, { cache: "no-store" }).then(r => r.json()), { revalidateOnFocus: false });

  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState<BrregItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/org/select", { cache: "no-store" });
        if (!res.ok) return;
        const d = await res.json();
        if (d?.organization_id) setSelected(String(d.organization_id));
      } catch {}
    })();
  }, []);

  async function doSearch() {
    setError(null);
    if (!query.trim()) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/brreg?q=${encodeURIComponent(query)}`, { cache: "no-store" });
      if (!res.ok) throw new Error(`Søk feilet (${res.status})`);
      const data = await res.json();
      setItems((data.items ?? []).slice(0, 10));
    } catch (e: any) {
      setError(e.message ?? "Ukjent feil");
      setItems([]);
    } finally {
      setLoading(false);
    }
  }

  async function choose(orgnr: string) {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/org/select", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ orgnr }),
      });
      if (!res.ok) throw new Error(`Valg feilet (${res.status})`);
      setSelected(orgnr);
      await mutate();
      router.refresh();
    } catch (e: any) {
      setError(e.message ?? "Ukjent feil");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-gray-200 bg-white/70 p-3">
        <div className="text-sm font-medium">Profilkontekst</div>
        <div className="mt-1 text-xs text-gray-600">
          {data?.organization ? (
            <>
              <div>Org: {data.organization.name ?? "(ukjent)"} ({data.organization.orgnr ?? data.organization.id})</div>
              {data.membership && (
                <div>Rolle: {data.membership.role} · Status: {data.membership.status}</div>
              )}
            </>
          ) : (
            <div>Ingen organisasjon valgt.</div>
          )}
        </div>
      </div>

      <div className="flex gap-2">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && doSearch()}
          placeholder="Søk etter orgnavn eller orgnr (9 siffer)"
          className="flex-1 rounded-xl border border-gray-200 bg-white/70 px-4 py-2 outline-none focus:ring-2 focus:ring-indigo-300"
        />
        <button
          onClick={doSearch}
          disabled={loading}
          className="rounded-xl px-4 py-2 font-medium shadow-sm ring-1 ring-indigo-200 bg-gradient-to-r from-indigo-500 to-fuchsia-500 text-white disabled:opacity-60"
        >
          {loading ? "Søker…" : "Søk"}
        </button>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>
      )}

      {items.length > 0 && (
        <ul className="divide-y divide-gray-100 overflow-hidden rounded-2xl border border-gray-200 bg-white/60">
          {items.map((it) => (
            <li key={it.orgnr} className="flex items-center justify-between gap-3 px-4 py-3">
              <div className="min-w-0">
                <div className="truncate font-medium">{it.name}</div>
                <div className="text-xs text-gray-500">Org.nr {it.orgnr}</div>
              </div>
              <button
                onClick={() => choose(it.orgnr)}
                className="rounded-lg bg-white px-3 py-1.5 text-sm font-medium ring-1 ring-gray-200 hover:bg-gray-50"
              >
                Velg
              </button>
            </li>
          ))}
        </ul>
      )}

      {selected && (
        <div className="text-sm text-emerald-700">Valgt organisasjon satt (orgnr {selected}). 🍀</div>
      )}
    </div>
  );
}


