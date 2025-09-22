"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";

type Props = {
  orgnr?: string | null;
  organizationId?: string | null;
  className?: string;
  children?: React.ReactNode;
};

export default function EnrichNowButton({ orgnr, organizationId, className = "", children }: Props) {
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const can = !!(orgnr || organizationId);

  async function run() {
    if (!can) return;
    setLoading(true);
    try {
      const res = await fetch("/api/org/enrich", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(orgnr ? { orgnr } : { organization_id: organizationId }),
      });
      if (!res.ok) throw new Error("enrich_failed");
    } catch {
      // Ignorer; visuell feedback gjennom state
    } finally {
      setLoading(false);
      router.refresh();
    }
  }

  return (
    <button
      disabled={!can || loading}
      onClick={run}
      className={`rounded-lg border px-3 py-1.5 text-xs hover:bg-gray-50 disabled:opacity-60 ${className}`}
      title={can ? "Oppdater alle berikede data" : "Mangler orgnr"}
    >
      {loading ? "Oppdaterer…" : (children ?? "Oppdater alt")}
    </button>
  );
}


