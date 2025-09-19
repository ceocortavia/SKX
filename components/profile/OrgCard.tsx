"use client";

import { useEffect, useState } from "react";

type Org = { organization_id: string; organization_name: string; orgnr: string | null; role: "member"|"admin"|"owner" };

export default function OrgCard() {
  const [loading, setLoading] = useState(true);
  const [context, setContext] = useState<any>(null);
  const [orgs, setOrgs] = useState<Org[]>([]);
  const [switching, setSwitching] = useState(false);
  const [leaving, setLeaving] = useState(false);

  async function load() {
    setLoading(true);
    const [ctxRes, orgRes] = await Promise.all([
      fetch('/api/profile/context', { cache: 'no-store' }),
      fetch('/api/profile/organizations', { cache: 'no-store' }),
    ]);
    const ctx = await ctxRes.json();
    const og = await orgRes.json();
    setContext(ctx);
    setOrgs(og.organizations ?? []);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  async function switchOrg(orgId: string) {
    try {
      setSwitching(true);
      const res = await fetch('/api/org/select', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ organization_id: orgId }),
      });
      if (!res.ok) throw new Error('switch_failed');
      await load();
    } finally {
      setSwitching(false);
    }
  }

  async function leaveOrg(orgId: string) {
    try {
      setLeaving(true);
      const res = await fetch('/api/profile/leave', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ organization_id: orgId }),
      });
      if (!res.ok) return;
      await load();
    } finally {
      setLeaving(false);
    }
  }

  if (loading) return <div className="rounded-xl border border-black/10 bg-white/70 backdrop-blur p-4">Laster …</div>;

  const selected = context?.organization;
  const membership = context?.membership;

  return (
    <div className="rounded-xl border border-black/10 bg-white/70 backdrop-blur p-4 space-y-4 shadow-sm">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-sm text-gray-500">Valgt organisasjon</div>
          {selected ? (
            <div className="font-medium">
              {selected.name} {selected.orgnr ? <span className="text-gray-500">({selected.orgnr})</span> : null}
            </div>
          ) : (
            <div className="font-medium">Ingen valgt</div>
          )}
          {membership ? (
            <div className="text-xs text-gray-500">Rolle: {membership.role}</div>
          ) : null}
        </div>
        {selected && membership?.role !== 'owner' ? (
          <button
            disabled={leaving}
            onClick={() => leaveOrg(selected.id)}
            className="rounded-lg border px-3 py-2 text-sm hover:bg-gray-50 disabled:opacity-50"
          >
            Forlat
          </button>
        ) : null}
      </div>

      <div>
        <div className="text-sm mb-2">Bytt organisasjon</div>
        <div className="flex gap-2 flex-wrap">
          {orgs.map((o) => (
            <button
              key={o.organization_id}
              onClick={() => switchOrg(o.organization_id)}
              disabled={switching || selected?.id === o.organization_id}
              className="rounded-lg border px-3 py-2 text-sm hover:bg-gray-50 disabled:opacity-50"
              title={o.role}
            >
              {o.organization_name}{o.orgnr ? ` (${o.orgnr})` : ''}
            </button>
          ))}
          {orgs.length === 0 && <div className="text-sm text-gray-500">Du er ikke medlem av noen organisasjoner.</div>}
        </div>
      </div>
    </div>
  );
}


