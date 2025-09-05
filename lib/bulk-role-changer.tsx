"use client";
import { useState } from 'react';

interface BulkRoleChangerProps {
  selectedIds: string[];
  onDone: () => void;
}

export function BulkRoleChanger({ selectedIds, onDone }: BulkRoleChangerProps) {
  const [role, setRole] = useState<'member'|'admin'>('member');
  const [loading, setLoading] = useState(false);

  const disabled = selectedIds.length === 0;

  async function applyRole() {
    try {
      setLoading(true);
      const res = await fetch("/api/memberships/bulk-role", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          ...(process.env.NEXT_PUBLIC_DEV_BYPASS === "1" ? {
            "x-test-clerk-user-id": process.env.NEXT_PUBLIC_DEV_BYPASS_USER_ID ?? "user_a",
            "x-test-clerk-email": process.env.NEXT_PUBLIC_DEV_BYPASS_EMAIL ?? "a@example.com",
            "x-test-org-id": process.env.NEXT_PUBLIC_DEV_BYPASS_ORG_ID ?? "",
            "x-test-mfa": "on",
          } : {})
        },
        body: JSON.stringify({ userIds: selectedIds, targetRole: role }),
      });
      const json = await res.json();
      if (!res.ok) {
        alert(`Failed: ${json?.error ?? res.status}`);
      } else {
        alert(`Role change → ${role}. Updated: ${json.updated}, Skipped: ${json.skipped?.length ?? 0}`);
      }
      onDone();
    } catch (error) {
      alert(`Error: ${error}`);
    } finally { 
      setLoading(false); 
    }
  }

  if (process.env.ADMIN_BULK_ROLE_ENABLED !== "1") {
    return null;
  }

  return (
    <div className="flex items-center gap-2">
      <select
        value={role}
        onChange={e => setRole(e.target.value as 'member'|'admin')}
        className="border rounded px-2 py-1"
      >
        <option value="member">member</option>
        <option value="admin">admin</option>
      </select>
      <button
        onClick={applyRole}
        disabled={disabled || loading}
        className="px-3 py-1 rounded bg-indigo-600 text-white disabled:opacity-50"
        title={disabled ? "Select users first" : "Apply role to selected"}
      >
        {loading ? "🔄 Applying…" : `Apply to ${selectedIds.length} selected`}
      </button>
    </div>
  );
}
