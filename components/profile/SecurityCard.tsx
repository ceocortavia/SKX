"use client";

import { useEffect, useState } from "react";

type Ctx = { ok?: boolean; mfa?: { enabled: boolean; verified: boolean } | null };

export default function SecurityCard() {
  const [ctx, setCtx] = useState<Ctx | null>(null);
  const [busy, setBusy] = useState(false);

  async function load() {
    const res = await fetch('/api/profile/context', { cache: 'no-store' });
    const j = await res.json();
    setCtx(j);
  }

  useEffect(() => { load(); }, []);

  async function revokeAll() {
    try {
      setBusy(true);
      const res = await fetch('/api/security/sessions/revoke-all', { method: 'POST' });
      if (!res.ok) throw new Error();
      // liten visuell feedback
      alert('Alle økter er logget ut');
      setTimeout(() => window.location.reload(), 600);
    } finally {
      setBusy(false);
    }
  }

  const mfaText = ctx?.mfa?.verified
    ? 'MFA er aktivert og verifisert'
    : ctx?.mfa?.enabled
      ? 'MFA er aktivert (ikke verifisert)'
      : 'MFA er ikke aktivert';

  return (
    <div className="rounded-xl border p-4 space-y-3">
      <div className="text-sm text-gray-500">Sikkerhet</div>
      <div className="flex items-center justify-between">
        <div>
          <div className="font-medium">MFA-status</div>
          <div className="text-sm text-gray-600">{mfaText}</div>
        </div>
        <div className="flex gap-2">
          <button onClick={load} className="rounded-lg border px-3 py-2 text-sm hover:bg-gray-50">Oppfrisk</button>
          <button onClick={revokeAll} disabled={busy} className="rounded-lg border px-3 py-2 text-sm hover:bg-gray-50 disabled:opacity-50">Logg ut alle økter</button>
        </div>
      </div>
      <div className="text-xs text-gray-500">Tips: Aktiver MFA i Clerk-kontoen for ekstra sikkerhet.</div>
    </div>
  );
}


