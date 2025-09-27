"use client";

import { useMemo, useState } from "react";

type Member = {
  user_id: string;
  name?: string | null;
  email?: string | null;
  role?: string | null;
};

type PendingItem = {
  requirement_key: string;
  policy_version_id: string;
  title: string;
  version: number;
};

interface Props {
  caseId: string;
  members: Member[];
  onAssigned?: () => void;
}

export function CaseAssignmentPanel({ caseId, members, onAssigned }: Props) {
  const [assignee, setAssignee] = useState<string>("");
  const [pending, setPending] = useState<PendingItem[]>([]);
  const [status, setStatus] = useState<"idle" | "loading" | "ok" | "err">("idle");
  const [error, setError] = useState<string | null>(null);

  const memberOptions = useMemo(
    () => members.filter((m) => (m.role ?? "").toLowerCase() !== "admin"),
    [members]
  );

  async function assign() {
    if (!assignee) return;
    setStatus("loading");
    setError(null);
    try {
      const res = await fetch(`/api/org/cases/${caseId}/assign`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: assignee }),
      });
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json?.error || "assign_failed");
      }
      setPending(json.pending || []);
      setStatus("ok");
      onAssigned?.();
    } catch (e: any) {
      setStatus("err");
      setError(String(e?.message || e));
    }
  }

  return (
    <div className="space-y-3">
      <h3 className="font-medium">Tildel sak</h3>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <select
          value={assignee}
          onChange={(e) => setAssignee(e.target.value)}
          className="min-w-[220px] rounded border px-3 py-2 text-sm"
        >
          <option value="">Velg bruker…</option>
          {memberOptions.map((m) => (
            <option key={m.user_id} value={m.user_id}>
              {m.name || m.email || m.user_id}
            </option>
          ))}
        </select>
        <button
          onClick={assign}
          disabled={!assignee || status === "loading"}
          className="rounded bg-black px-4 py-2 text-sm font-medium text-white disabled:opacity-40"
        >
          {status === "loading" ? "Tildeler…" : "Tildel"}
        </button>
        {status === "ok" && <span className="text-sm text-green-700">Tildelt ✓</span>}
        {error && <span className="text-sm text-red-600">{error}</span>}
      </div>
      {pending.length > 0 && (
        <div className="rounded border border-gray-200 bg-white p-3 text-sm">
          <div className="font-medium">Krav som gjenstår:</div>
          <ul className="ml-4 list-disc">
            {pending.map((item) => (
              <li key={`${item.policy_version_id}-${item.requirement_key}`}>
                {item.title} (v{item.version}) – {item.requirement_key}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

