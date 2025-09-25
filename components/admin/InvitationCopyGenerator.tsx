'use client';

export default function InvitationCopyGenerator() {
  return (
    <div className="rounded border p-4 bg-white">
      <div className="font-medium">Invitation Copy Generator</div>
      <p className="text-sm text-gray-600">Placeholder – funksjon kommer senere.</p>
    </div>
  );
}

"use client";

import { useState } from "react";
import CopyButton from "@/components/ui/CopyButton";

interface Variant {
  id: string;
  subject: string;
  body: string;
}

interface GeneratorResponse {
  variants: Variant[];
  runId?: string;
}

export default function InvitationCopyGenerator() {
  const [role, setRole] = useState("member");
  const [tone, setTone] = useState<"formal" | "friendly">("friendly");
  const [language, setLanguage] = useState<"nb" | "en">("nb");
  const [mission, setMission] = useState("");
  const [variants, setVariants] = useState<Variant[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [saving, setSaving] = useState<string | null>(null);

  async function generate() {
    setLoading(true);
    setError(null);
    setMessage(null);
    try {
      const res = await fetch("/api/org/invitations/copy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          role,
          language,
          tone,
          orgContext: {
            displayName: undefined,
            mission: mission || undefined,
          },
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.error ?? "Kunne ikke generere invitasjoner");
      }
      const data = (await res.json()) as GeneratorResponse;
      setVariants(Array.isArray(data.variants) ? data.variants : []);
      if ((data.variants ?? []).length === 0) {
        setMessage("Ingen forslag tilgjengelig");
      }
    } catch (err: any) {
      setError(err?.message ?? "Ukjent feil");
    } finally {
      setLoading(false);
    }
  }

  async function saveTemplate(variant: Variant) {
    setSaving(variant.id);
    setError(null);
    setMessage(null);
    try {
      const res = await fetch("/api/org/templates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "INVITE",
          locale: language,
          subject: variant.subject,
          body: variant.body,
          meta: { tone, role },
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.error ?? "Kunne ikke lagre malen");
      }
      const data = await res.json();
      setMessage(`Mal lagret (${data?.templateId ?? "ok"})`);
    } catch (err: any) {
      setError(err?.message ?? "Kunne ikke lagre malen");
    } finally {
      setSaving(null);
    }
  }

  return (
    <div className="rounded-2xl border border-gray-200 bg-white/70 backdrop-blur p-4 shadow-sm space-y-4">
      <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
        <div>
          <h3 className="text-sm font-semibold">Invitasjonstekst-generator</h3>
          <p className="text-xs text-gray-500">Få 2–3 forslag til emnefelt og brødtekst basert på rolle, tone og språk.</p>
        </div>
        <button
          onClick={generate}
          className="inline-flex items-center rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium shadow-sm hover:bg-gray-50 disabled:opacity-50"
          disabled={loading}
        >
          {loading ? "Genererer…" : "Generer forslag"}
        </button>
      </div>

      <div className="grid gap-3 md:grid-cols-4">
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-xs uppercase tracking-wide text-gray-500">Rolle</span>
          <select
            value={role}
            onChange={(e) => setRole(e.target.value)}
            className="rounded-lg border border-gray-200 px-2 py-1.5 text-sm"
          >
            <option value="owner">Eier</option>
            <option value="admin">Admin</option>
            <option value="member">Medlem</option>
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-xs uppercase tracking-wide text-gray-500">Tone</span>
          <select
            value={tone}
            onChange={(e) => setTone(e.target.value as "formal" | "friendly")}
            className="rounded-lg border border-gray-200 px-2 py-1.5 text-sm"
          >
            <option value="formal">Formell</option>
            <option value="friendly">Vennlig</option>
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-xs uppercase tracking-wide text-gray-500">Språk</span>
          <select
            value={language}
            onChange={(e) => setLanguage(e.target.value as "nb" | "en")}
            className="rounded-lg border border-gray-200 px-2 py-1.5 text-sm"
          >
            <option value="nb">Norsk (bokmål)</option>
            <option value="en">English</option>
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm md:col-span-1">
          <span className="text-xs uppercase tracking-wide text-gray-500">Mission (valgfritt)</span>
          <input
            value={mission}
            onChange={(e) => setMission(e.target.value)}
            placeholder="Kort beskrivelse"
            className="rounded-lg border border-gray-200 px-2 py-1.5 text-sm"
          />
        </label>
      </div>

      {error && (
        <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>
      )}
      {message && (
        <div className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{message}</div>
      )}

      {variants.length > 0 && (
        <div className="grid gap-4 md:grid-cols-2">
          {variants.map((variant, idx) => (
            <div key={variant.id} className="rounded-xl border border-gray-200 bg-white px-4 py-3 shadow-sm space-y-2">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-xs uppercase tracking-wide text-gray-500">Variant {idx + 1}</div>
                  <div className="text-sm font-semibold">{variant.subject}</div>
                </div>
                <CopyButton value={`${variant.subject}\n\n${variant.body}`} className="text-xs text-indigo-600">
                  Kopier tekst
                </CopyButton>
              </div>
              <pre className="whitespace-pre-wrap rounded-lg bg-gray-50 px-3 py-2 text-sm text-gray-700">
                {variant.body}
              </pre>
              <div className="flex justify-end">
                <button
                  onClick={() => saveTemplate(variant)}
                  disabled={saving === variant.id}
                  className="text-xs font-medium text-indigo-600 hover:text-indigo-500 disabled:opacity-50"
                >
                  {saving === variant.id ? "Lagrer…" : "Lagre som mal"}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

