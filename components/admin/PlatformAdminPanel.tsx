"use client";

import { useEffect, useMemo, useState } from "react";
import useSWR from "swr";
import { jsonFetcher } from "@/lib/fetcher";

interface PlatformStats {
  organizations: number;
  members: number;
  approvedMembers: number;
  pendingInvitations: number;
  dbSuperAdmins: number;
  envSuperAdmins: number;
  totalSuperAdmins: number;
}

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

interface PlatformAdminRow {
  source: "db" | "env";
  userId: string | null;
  email: string | null;
  clerkUserId: string | null;
  fullName: string | null;
  grantedAt: string | null;
}

interface ApiResponse<T> {
  ok: boolean;
  error?: string;
  reason?: string;
  [key: string]: any;
}

export default function PlatformAdminPanel() {
  const { data: statsData } = useSWR<ApiResponse<{ stats: PlatformStats }>>("/api/platform/stats", jsonFetcher, {
    revalidateOnFocus: false,
  });

  const { data: adminsData, error: adminsError, mutate: mutateAdmins } = useSWR<ApiResponse<{ admins: PlatformAdminRow[] }>>(
    "/api/platform/admins",
    jsonFetcher,
    { revalidateOnFocus: false }
  );

  const { data: orgsData, error: orgsError } = useSWR<ApiResponse<{ organizations: PlatformOrganization[] }>>(
    "/api/platform/organizations",
    jsonFetcher,
    { revalidateOnFocus: false }
  );

  const organizations = orgsData?.organizations ?? [];
  const stats = statsData?.stats;
  const admins = useMemo(() => adminsData?.admins ?? [], [adminsData]);

  const [selectedOrg, setSelectedOrg] = useState<string | null>(null);
  useEffect(() => {
    if (!selectedOrg && organizations.length > 0) {
      setSelectedOrg(organizations[0].id);
    }
  }, [organizations, selectedOrg]);

  const membersKey = useMemo(() => (selectedOrg ? `/api/platform/members?organizationId=${selectedOrg}` : null), [selectedOrg]);

  const {
    data: membersData,
    mutate: mutateMembers,
    error: membersError,
  } = useSWR<ApiResponse<{ members: PlatformMember[] }>>(membersKey, jsonFetcher, { revalidateOnFocus: false });

  const members = membersData?.members ?? [];

  const [busyId, setBusyId] = useState<string | null>(null);
  const [memberMessage, setMemberMessage] = useState<string | null>(null);
  const [emailInput, setEmailInput] = useState("");
  const [adminMessage, setAdminMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const unauthorized = adminsError instanceof Error && /403/.test(adminsError.message);

  async function updateMember(member: PlatformMember, updates: Partial<Pick<PlatformMember, "role" | "status">>) {
    setBusyId(member.user_id + member.organization_id);
    setMemberMessage(null);
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
      setMemberMessage("Lagret oppdatering ✔");
    } catch (error: any) {
      setMemberMessage(`Kunne ikke lagre: ${error?.message || "ukjent feil"}`);
    } finally {
      setBusyId(null);
      setTimeout(() => setMemberMessage(null), 4000);
    }
  }

  async function addSuperAdmin() {
    setAdminMessage(null);
    const email = emailInput.trim();
    if (!email) {
      setAdminMessage({ type: "error", text: "Angi en gyldig e-post" });
      return;
    }
    try {
      const res = await fetch("/api/platform/admins", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const json = (await res.json()) as ApiResponse<unknown>;
      if (!res.ok || !json.ok) {
        const reason = json.error || json.reason || res.statusText;
        throw new Error(reason);
      }
      setEmailInput("");
      await mutateAdmins();
      setAdminMessage({ type: "success", text: `${email} er nå super-admin` });
    } catch (error: any) {
      setAdminMessage({ type: "error", text: error?.message || "Kunne ikke legge til" });
    } finally {
      setTimeout(() => setAdminMessage(null), 4000);
    }
  }

  async function removeSuperAdmin(email: string | null) {
    if (!email) return;
    setAdminMessage(null);
    try {
      const res = await fetch("/api/platform/admins", {
        method: "DELETE",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const json = (await res.json()) as ApiResponse<unknown>;
      if (!res.ok || !json.ok) {
        const reason = json.error || json.reason || res.statusText;
        throw new Error(reason);
      }
      await mutateAdmins();
      setAdminMessage({ type: "success", text: `${email} er ikke lenger super-admin` });
    } catch (error: any) {
      setAdminMessage({ type: "error", text: error?.message || "Kunne ikke fjerne" });
    } finally {
      setTimeout(() => setAdminMessage(null), 4000);
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

  if (adminsError && !unauthorized) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-semibold">Platform-admin</h1>
        <p className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          Feil ved lasting av konsoll: {String(adminsError)}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold">Platform-admin</h1>
        <p className="text-sm text-gray-600">
          Et overblikk for super-admins. Her kan du styre andre super-admins, se aggregerte tall og hoppe inn i organisasjons- og medlemsstyring.
        </p>
      </header>

      <section>
        <h2 className="text-lg font-medium text-gray-800">Nøkkeltall</h2>
        <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard label="Organisasjoner" value={stats?.organizations ?? 0} />
          <StatCard label="Medlemmer" value={stats?.members ?? 0} hint={`Godkjente: ${stats?.approvedMembers ?? 0}`} />
          <StatCard label="Pending invitasjoner" value={stats?.pendingInvitations ?? 0} />
          <StatCard
            label="Super-admins"
            value={stats?.totalSuperAdmins ?? 0}
            hint={`DB: ${stats?.dbSuperAdmins ?? 0} • Env: ${stats?.envSuperAdmins ?? 0}`}
          />
        </div>
      </section>

      <section className="space-y-4">
        <div className="flex flex-col gap-1">
          <h2 className="text-lg font-medium text-gray-800">Administrer super-admins</h2>
          <p className="text-sm text-gray-500">
            Endringer lagres i tabellen <code className="font-mono text-xs">platform_admins</code>. Brukere lagt til via env (
            <code className="font-mono text-xs">SUPER_ADMINS</code>) vises som skrivebeskyttet.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <input
            type="email"
            value={emailInput}
            onChange={(e) => setEmailInput(e.target.value)}
            placeholder="superadmin@firma.no"
            className="w-full max-w-xs rounded-lg border border-gray-200 px-3 py-2 text-sm shadow-sm focus:border-indigo-400 focus:outline-none"
          />
          <button
            onClick={addSuperAdmin}
            className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow hover:bg-indigo-500"
          >
            Legg til
          </button>
        </div>
        {adminMessage && (
          <div
            className={`rounded-lg border p-3 text-sm ${
              adminMessage.type === "success"
                ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                : "border-red-200 bg-red-50 text-red-700"
            }`}
          >
            {adminMessage.text}
          </div>
        )}
        <div className="overflow-hidden rounded-xl border border-gray-200 bg-white/70 shadow-sm">
          <table className="min-w-full divide-y divide-gray-200 text-sm">
            <thead className="bg-gray-50/80">
              <tr>
                <th className="px-4 py-3 text-left font-medium text-gray-600">E-post</th>
                <th className="px-4 py-3 text-left font-medium text-gray-600">Navn</th>
                <th className="px-4 py-3 text-left font-medium text-gray-600">Kilde</th>
                <th className="px-4 py-3 text-left font-medium text-gray-600">Opprettet</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {admins.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-6 text-center text-sm text-gray-500">
                    Ingen super-admins funnet.
                  </td>
                </tr>
              ) : (
                admins.map((admin: PlatformAdminRow, index: number) => (
                  <tr
                    key={`${admin.source}-${admin.userId ?? admin.email ?? "unknown"}-${index}`}
                    className="bg-white/40"
                  >
                    <td className="px-4 py-3 text-gray-800">{admin.email ?? "–"}</td>
                    <td className="px-4 py-3 text-gray-700">{admin.fullName ?? "–"}</td>
                    <td className="px-4 py-3 text-sm text-gray-500">
                      {admin.source === "env" ? "Env" : "Database"}
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-500">
                      {admin.grantedAt ? new Date(admin.grantedAt).toLocaleString("no-NO") : "–"}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {admin.source === "db" && (
                        <button
                          onClick={() => removeSuperAdmin(admin.email)}
                          className="rounded border border-red-200 px-3 py-1 text-xs font-medium text-red-600 hover:bg-red-50"
                        >
                          Fjern
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="space-y-4">
        <div className="flex flex-col gap-1">
          <h2 className="text-lg font-medium text-gray-800">Organisasjoner & medlemmer</h2>
          <p className="text-sm text-gray-500">
            Velg en organisasjon for å se og oppdatere roller eller status på medlemmer.
          </p>
        </div>
        {/* Tech-filter og CSV-eksport */}
        <TechFilterAndExport />
        {orgsError && (
          <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            Klarte ikke å laste organisasjoner: {String(orgsError)}
          </div>
        )}
        {organizations.length === 0 ? (
          <div className="rounded-lg border border-gray-200 bg-white/70 p-6 text-sm text-gray-600">
            Ingen organisasjoner tilgjengelig ennå.
          </div>
        ) : (
          <div className="flex flex-wrap gap-3">
            {organizations.map((org: PlatformOrganization) => (
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
                {org.homepage_domain && (
                  <div className="mt-1 text-[11px] text-gray-600">{org.homepage_domain}</div>
                )}
              </button>
            ))}
          </div>
        )}

        {memberMessage && (
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">
            {memberMessage}
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
                  members.map((member: PlatformMember) => {
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
      </section>
    </div>
  );
}

function TechFilterAndExport() {
  const [techInput, setTechInput] = useState("");
  const [busy, setBusy] = useState(false);

  const applyFilter = () => {
    const params = new URLSearchParams(window.location.search);
    if (techInput.trim()) params.set("tech", techInput.trim()); else params.delete("tech");
    const url = `${window.location.pathname}?${params.toString()}`;
    window.history.replaceState({}, "", url);
    // Re-trigger SWR by full reload to keep changes minimal here
    window.location.reload();
  };

  const exportCsv = async () => {
    setBusy(true);
    try {
      const params = new URLSearchParams(window.location.search);
      if (techInput.trim()) params.set("tech", techInput.trim());
      params.set("csv", "1");
      const url = `/api/platform/organizations?${params.toString()}`;
      const res = await fetch(url, { headers: { accept: "text/csv" } });
      const text = await res.text();
      const blob = new Blob([text], { type: "text/csv;charset=utf-8" });
      const link = document.createElement("a");
      link.href = URL.createObjectURL(blob);
      link.download = "organizations.csv";
      document.body.appendChild(link);
      link.click();
      link.remove();
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const current = params.get("tech") ?? "";
    setTechInput(current);
  }, []);

  return (
    <div className="flex flex-wrap items-end gap-2">
      <div className="flex flex-col gap-1">
        <label className="text-xs text-gray-600">Filter på teknologier (komma-separert)</label>
        <input
          value={techInput}
          onChange={(e) => setTechInput(e.target.value)}
          placeholder="react,shopify"
          className="rounded-lg border border-gray-200 px-3 py-2 text-sm shadow-sm focus:border-indigo-400 focus:outline-none"
        />
      </div>
      <button onClick={applyFilter} className="rounded-lg bg-slate-600 px-3 py-2 text-sm font-medium text-white shadow hover:bg-slate-500">
        Filtrer
      </button>
      <button onClick={exportCsv} disabled={busy} className="rounded-lg bg-emerald-600 px-3 py-2 text-sm font-medium text-white shadow hover:bg-emerald-500 disabled:opacity-60">
        {busy ? "Eksporterer…" : "Eksporter CSV"}
      </button>
    </div>
  );
}

function StatCard({ label, value, hint }: { label: string; value: number; hint?: string }) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white/70 p-4 shadow-sm">
      <div className="text-sm font-medium text-gray-500">{label}</div>
      <div className="mt-2 text-3xl font-semibold text-gray-900">{value.toLocaleString("no-NO")}</div>
      {hint && <div className="mt-1 text-xs text-gray-500">{hint}</div>}
    </div>
  );
}
