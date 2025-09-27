"use client";

import { useState } from "react";
import useSWR from "swr";
import { useRouter } from "next/navigation";

type BrregItem = { orgnr: string; name: string };

type OrgMembership = {
  id: string;
  orgnr: string | null;
  name: string | null;
  role: "owner" | "admin" | "member";
  status: "approved" | "pending";
};

type ProfileContext = {
  organization: { id: string; orgnr: string | null; name: string | null } | null;
  membership: { role: "owner" | "admin" | "member"; status: "approved" | "pending" } | null;
  organizations: OrgMembership[];
  mfa: boolean;
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
  const [notice, setNotice] = useState<string | null>(null);

  const activeOrgId = data?.organization?.id ?? null;
  const organizations = data?.organizations ?? [];

  async function switchOrganization(orgId: string) {
    if (!orgId || orgId === activeOrgId) return;
    setLoading(true);
    setError(null);
    setNotice(null);
    try {
      const res = await fetch("/api/org/select", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ organization_id: orgId }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j?.error || `Feil ved valg (${res.status})`);
      }
      await mutate();
      router.refresh();
      setNotice("Aktiv organisasjon oppdatert.");
    } catch (e: any) {
      setError(e?.message || "Kunne ikke bytte organisasjon");
    } finally {
      setLoading(false);
    }
  }

  async function leaveOrganization(orgId: string) {
    setLoading(true);
    setError(null);
    setNotice(null);
    try {
      const res = await fetch("/api/profile/leave", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ organization_id: orgId }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || json?.ok === false) {
        const reason = json?.reason || json?.error;
        if (reason === "last_owner") {
          throw new Error("Du er siste eier – legg til ny eier før du kan forlate organisasjonen.");
        }
        if (reason === "not_member") {
          throw new Error("Du er ikke medlem av denne organisasjonen.");
        }
        throw new Error("Kunne ikke forlate organisasjonen.");
      }
      await mutate();
      router.refresh();
      setNotice("Du har forlatt organisasjonen.");
    } catch (e: any) {
      setError(e?.message || "Feil ved forlat organisasjon");
    } finally {
      setLoading(false);
    }
  }

  async function doSearch() {
    setError(null);
    if (!query.trim()) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/brreg?q=${encodeURIComponent(query)}`, { cache: "no-store" });
      if (!res.ok) throw new Error(`Søk feilet (${res.status})`);
      const data = await res.json();
      const list = (data.items ?? []).slice(0, 10);
      setItems(list);
      if (list.length === 0) {
        setError("Ingen treff – prøv et annet navn eller orgnr.");
      }
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
    setNotice(null);
    try {
      const res = await fetch("/api/org/select", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ orgnr }),
      });
      if (!res.ok) throw new Error(`Valg feilet (${res.status})`);
      await mutate();
      router.refresh();
      setNotice("Organisasjonen er lagt til og satt som aktiv.");
      setItems([]);
      setQuery("");
    } catch (e: any) {
      setError(e.message ?? "Ukjent feil");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="space-y-2 rounded-xl border border-gray-200 bg-white/70 p-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="text-sm font-medium">Aktiv organisasjon</div>
            {data?.organization ? (
              <div className="mt-1 text-xs text-gray-600">
                {data.organization.name ?? "(ukjent)"}
                {data.organization.orgnr ? ` (${data.organization.orgnr})` : ""}
                {data.membership && (
                  <span className="ml-2 rounded-full bg-gray-100 px-2 py-0.5 text-[11px] uppercase tracking-wide text-gray-600">
                    {data.membership.role} · {data.membership.status}
                  </span>
                )}
              </div>
            ) : (
              <div className="mt-1 text-xs text-gray-600">Ingen organisasjon valgt.</div>
            )}
          </div>
          <select
            value={activeOrgId ?? ""}
            onChange={(e) => switchOrganization(e.target.value)}
            disabled={organizations.length === 0 || loading}
            className="min-w-[220px] rounded border border-gray-300 px-3 py-2 text-sm"
          >
            <option value="">Velg organisasjon…</option>
            {organizations.map((org) => (
              <option key={org.id} value={org.id}>
                {org.name ?? org.orgnr ?? org.id} ({org.role})
              </option>
            ))}
          </select>
        </div>
        {activeOrgId && (
          <button
            onClick={() => leaveOrganization(activeOrgId)}
            disabled={loading}
            className="text-xs text-red-600 underline disabled:opacity-60"
          >
            Forlat denne organisasjonen
          </button>
        )}
      </div>

      {organizations.length > 1 && (
        <div className="rounded-xl border border-gray-200 bg-white/60 p-4">
          <div className="text-sm font-medium">Dine organisasjoner</div>
          <table className="mt-2 w-full text-left text-xs">
            <thead className="text-gray-500">
              <tr>
                <th className="py-1 pr-2">Navn</th>
                <th className="py-1 pr-2">Org.nr</th>
                <th className="py-1 pr-2">Rolle</th>
                <th className="py-1 pr-2">Status</th>
                <th className="py-1 text-right">Handling</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {organizations.map((org) => (
                <tr key={org.id}>
                  <td className="py-2 pr-2 text-sm">{org.name ?? "(ukjent)"}</td>
                  <td className="py-2 pr-2 text-xs text-gray-500">{org.orgnr ?? "—"}</td>
                  <td className="py-2 pr-2 text-xs text-gray-500">{org.role}</td>
                  <td className="py-2 pr-2 text-xs text-gray-500">{org.status}</td>
                  <td className="py-2 text-right">
                    {activeOrgId === org.id ? (
                      <span className="text-xs text-emerald-600">Aktiv</span>
                    ) : (
                      <button
                        onClick={() => switchOrganization(org.id)}
                        disabled={loading}
                        className="text-xs text-indigo-600 underline disabled:opacity-60"
                      >
                        Bytt til
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

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

      {notice && (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{notice}</div>
      )}
    </div>
  );
}

