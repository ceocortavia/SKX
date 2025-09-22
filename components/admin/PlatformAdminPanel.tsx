"use client";

import React, { useEffect, useState } from "react";

type Org = { id: string; orgnr: string | null; name: string | null; status_text: string | null; updated_at: string };
type Member = { user_id: string; organization_id: string; role: string; status: string; primary_email: string | null };

export default function PlatformAdminPanel() {
  const [orgs, setOrgs] = useState<Org[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const r = await fetch('/api/platform/organizations', { cache: 'no-store' });
        const d = await r.json();
        if (!r.ok || !d?.ok) throw new Error(d?.error || 'failed');
        setOrgs(d.organizations || []);
      } catch (e: any) {
        setError(e.message || 'Kunne ikke laste organisasjoner');
      }
    })();
  }, []);

  async function loadMembers(orgId: string) {
    setSelected(orgId);
    try {
      const r = await fetch(`/api/platform/members?orgId=${orgId}`, { cache: 'no-store' });
      const d = await r.json();
      if (!r.ok || !d?.ok) throw new Error(d?.error || 'failed');
      setMembers(d.members || []);
    } catch (e: any) {
      setError(e.message || 'Kunne ikke laste medlemmer');
    }
  }

  return (
    <div className="space-y-4">
      {error && <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}
      <div className="rounded-xl border border-gray-200 bg-white/70 p-4">
        <div className="text-sm font-medium mb-2">Organisasjoner</div>
        <div className="grid gap-2 sm:grid-cols-2">
          {orgs.map(o => (
            <button key={o.id} onClick={() => loadMembers(o.id)} className={`text-left rounded-lg border px-3 py-2 text-sm hover:bg-gray-50 ${selected===o.id?'ring-1 ring-indigo-300':''}`}>
              <div className="font-medium">{o.name ?? '(ukjent)'} {o.orgnr?`(${o.orgnr})`:''}</div>
              <div className="text-xs text-gray-500">{o.status_text ?? '—'} · {new Date(o.updated_at).toLocaleString('nb-NO')}</div>
            </button>
          ))}
          {orgs.length===0 && <div className="text-sm text-gray-500">Ingen organisasjoner.</div>}
        </div>
      </div>
      <div className="rounded-xl border border-gray-200 bg-white/70 p-4">
        <div className="text-sm font-medium mb-2">Medlemmer {selected ? `(org ${selected.slice(0,6)}…)` : ''}</div>
        <div className="space-y-1">
          {members.map(m => (
            <div key={`${m.user_id}-${m.organization_id}`} className="rounded border border-gray-200 bg-white/60 px-3 py-2 text-sm flex justify-between">
              <span>{m.primary_email ?? m.user_id}</span>
              <span className="text-xs text-gray-500">{m.role} · {m.status}</span>
            </div>
          ))}
          {selected && members.length===0 && <div className="text-sm text-gray-500">Ingen medlemmer.</div>}
        </div>
      </div>
    </div>
  );
}

"use client";

import { useEffect, useMemo, useState } from "react";
import useSWR from "swr";
import { jsonFetcher } from "@/lib/fetcher";

interface PlatformOrganization {
  id: string;
  name: string | null;
  orgnr: string | null;
  status_text: string | null;
  homepage_domain: string | null;
  created_at: string;
  updated_at: string;
  registered_at: string | null;
}

interface PlatformMember {
  user_id: string;
  organization_id: string;
  role: "owner" | "admin" | "member";
  status: "approved" | "pending";
  created_at: string;
  updated_at: string;
  approved_at: string | null;
  clerk_user_id: string;
  primary_email: string | null;
  full_name: string | null;
  organization_name: string | null;
  organization_orgnr: string | null;
}

interface ApiResponse<T> {
  ok: boolean;
  error?: string;
  reason?: string;
  [key: string]: any;
}

export default function PlatformAdminPanel() {
  const { data: orgsData, error: orgsError } = useSWR<ApiResponse<{ organizations: PlatformOrganization[] }>>("/api/platform/organizations", jsonFetcher, {
    revalidateOnFocus: false,
  });

  const organizations = orgsData?.organizations ?? [];
  const [selectedOrg, setSelectedOrg] = useState<string | null>(null);

  useEffect(() => {
    if (!selectedOrg && organizations.length > 0) {
      setSelectedOrg(organizations[0].id);
    }
  }, [organizations, selectedOrg]);

  const membersKey = useMemo(() => {
    if (!selectedOrg) return null;
    return `/api/platform/members?organizationId=${selectedOrg}`;
  }, [selectedOrg]);

  const {
    data: membersData,
    mutate: mutateMembers,
    error: membersError,
  } = useSWR<ApiResponse<{ members: PlatformMember[] }>>(membersKey, jsonFetcher, {
    revalidateOnFocus: false,
  });

  const members = membersData?.members ?? [];

  const [busyId, setBusyId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const unauthorized = orgsError instanceof Error && /403/.test(orgsError.message);

  async function updateMember(member: PlatformMember, updates: Partial<Pick<PlatformMember, "role" | "status">>) {
    setBusyId(member.user_id + member.organization_id);
    setMessage(null);
    try {
      const res = await fetch("/api/platform/members", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          organizationId: member.organization_id,
          userId: member.user_id,
          role: updates.role,
          status: updates.status,
        }),
      });
      const json = (await res.json()) as ApiResponse<unknown>;
      if (!res.ok || !json.ok) {
        const reason = json.reason || json.error || res.statusText;
        throw new Error(reason);
      }
      await mutateMembers();
      setMessage("Lagret oppdatering ✔");
    } catch (error: any) {
      setMessage(`Kunne ikke lagre: ${error?.message || "ukjent feil"}`);
    } finally {
      setBusyId(null);
      setTimeout(() => setMessage(null), 4000);
    }
  }

  if (unauthorized) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-semibold">Platform-admin</h1>
        <p className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          Du har ikke tilgang til denne visningen. Kontakt en eksisterende platform-admin for å få tilgang.
        </p>
      </div>
    );
  }

  if (orgsError) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-semibold">Platform-admin</h1>
        <p className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          Feil: {String(orgsError)}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold">Platform-admin</h1>
        <p className="text-sm text-gray-600">
          Administrer medlemmer på tvers av organisasjoner. Endringer oppdateres umiddelbart og er underlagt RLS-loggføring.
        </p>
      </header>

      {organizations.length === 0 ? (
        <div className="rounded-lg border border-gray-200 bg-white/70 p-6 text-sm text-gray-600">
          Ingen organisasjoner tilgjengelig ennå.
        </div>
      ) : (
        <div className="flex flex-wrap gap-3">
          {organizations.map((org) => (
            <button
              key={org.id}
              onClick={() => setSelectedOrg(org.id)}
              className={`rounded-lg border px-4 py-2 text-sm shadow-sm transition ${
                selectedOrg === org.id
                  ? "border-indigo-500 bg-indigo-50 text-indigo-700"
                  : "border-gray-200 bg-white/70 hover:border-indigo-300"
              }`}
            >
              <div className="font-medium">{org.name ?? "(navn mangler)"}</div>
              <div className="text-xs text-gray-500">{org.orgnr ?? ""}</div>
            </button>
          ))}
        </div>
      )}

      {message && (
        <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">
          {message}
        </div>
      )}

      {membersError && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          Klarte ikke å laste medlemmer: {String(membersError)}
        </div>
      )}

      {membersKey && !membersError && (
        <div className="overflow-hidden rounded-xl border border-gray-200 bg-white/70 shadow-sm">
          <table className="min-w-full divide-y divide-gray-200 text-sm">
            <thead className="bg-gray-50/80">
              <tr>
                <th className="px-4 py-3 text-left font-medium text-gray-600">Bruker</th>
                <th className="px-4 py-3 text-left font-medium text-gray-600">E-post</th>
                <th className="px-4 py-3 text-left font-medium text-gray-600">Rolle</th>
                <th className="px-4 py-3 text-left font-medium text-gray-600">Status</th>
                <th className="px-4 py-3 text-left font-medium text-gray-600">Oppdatert</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {members.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-6 text-center text-sm text-gray-500">
                    Ingen medlemmer funnet for valgt organisasjon.
                  </td>
                </tr>
              ) : (
                members.map((member) => {
                  const id = member.user_id + member.organization_id;
                  return (
                    <tr key={id} className="bg-white/40">
                      <td className="px-4 py-3">
                        <div className="font-medium text-gray-800">{member.full_name ?? member.clerk_user_id}</div>
                        <div className="text-xs text-gray-500">{member.clerk_user_id}</div>
                      </td>
                      <td className="px-4 py-3 text-gray-700">{member.primary_email ?? "–"}</td>
                      <td className="px-4 py-3">
                        <select
                          className="rounded border border-gray-300 px-2 py-1 text-sm"
                          value={member.role}
                          disabled={busyId === id}
                          onChange={(e) =>
                            updateMember(member, { role: e.target.value as PlatformMember["role"] })
                          }
                        >
                          <option value="owner">Owner</option>
                          <option value="admin">Admin</option>
                          <option value="member">Member</option>
                        </select>
                      </td>
                      <td className="px-4 py-3">
                        <select
                          className="rounded border border-gray-300 px-2 py-1 text-sm"
                          value={member.status}
                          disabled={busyId === id}
                          onChange={(e) =>
                            updateMember(member, { status: e.target.value as PlatformMember["status"] })
                          }
                        >
                          <option value="approved">Approved</option>
                          <option value="pending">Pending</option>
                        </select>
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-500">
                        {new Date(member.updated_at).toLocaleString("no-NO")}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
