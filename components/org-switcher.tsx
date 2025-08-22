"use client";
import { useEffect, useState } from "react";

type Membership = { org_id: string; org_name: string; role: string; status: string };

export default function OrgSwitcher() {
  const [items, setItems] = useState<Membership[]>([]);
  const [loading, setLoading] = useState(false);
  const [orgId, setOrgId] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    fetch("/api/memberships")
      .then((r) => r.json())
      .then((j) => setItems(j.memberships ?? []))
      .finally(() => setLoading(false));
  }, []);

  async function onSelect(id: string) {
    setOrgId(id);
    await fetch("/api/org/switch", { method: "POST", headers: { "x-org-id": id } });
    window.location.reload();
  }

  return (
    <div data-testid="org-switcher">
      <select
        disabled={loading || items.length === 0}
        value={orgId ?? ""}
        onChange={(e) => onSelect(e.target.value)}
      >
        <option value="" disabled>
          {loading ? "Laster..." : items.length ? "Velg organisasjon" : "Ingen organisasjoner"}
        </option>
        {items.map((m) => (
          <option key={m.org_id} value={m.org_id}>
            {m.org_name} ({m.role}/{m.status})
          </option>
        ))}
      </select>
    </div>
  );
}


