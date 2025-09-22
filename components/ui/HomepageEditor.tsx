"use client";

import React, { useState } from "react";

type Props = {
  organizationId: string;
  initialDomain?: string | null;
};

export default function HomepageEditor({ organizationId, initialDomain }: Props) {
  const [value, setValue] = useState(initialDomain ?? "");
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function save() {
    setSaving(true);
    setMsg(null);
    try {
      const res = await fetch('/api/org/homepage', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ organization_id: organizationId, homepage: value })
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.ok) throw new Error(data?.error || 'save_failed');
      setValue(data.homepage_domain || value);
      setMsg('Oppdatert');
    } catch (e: any) {
      setMsg(e?.message || 'Kunne ikke oppdatere');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
      <input
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="www.dittdomene.no eller full URL"
        className="flex-1 rounded-lg border border-gray-200 bg-white/70 px-3 py-1.5 text-sm outline-none focus:ring-2 focus:ring-indigo-300"
      />
      <button
        disabled={!value || saving}
        onClick={save}
        className="rounded-lg border px-3 py-1.5 text-xs hover:bg-gray-50 disabled:opacity-60"
      >
        {saving ? 'Lagrer…' : 'Lagre og oppdater'}
      </button>
      {msg && <span className="text-xs text-gray-500">{msg}</span>}
    </div>
  );
}


