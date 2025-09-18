"use client";

import useSWR from "swr";
import { jsonFetcher } from "@/lib/fetcher";

type MembersAnalytics = {
  total: number;
  byRole: Record<string, number>;
  byStatus: Record<string, number>;
};

type InvitationsAnalytics = {
  total: number;
  series: { date: string; pending: number; accepted: number }[];
};

type AuditAnalytics = {
  actions: { action: string; count: number }[];
  series: { date: string; count: number }[];
};

function TinyStat({ label, value }: { label: string; value: number|string }) {
  return (
    <div className="rounded-xl border p-4 shadow-sm">
      <div className="text-sm text-gray-500">{label}</div>
      <div className="mt-1 text-2xl font-semibold">{value}</div>
    </div>
  );
}

function TextBar({ label, count, total }: { label: string; count: number; total: number }) {
  const pct = total > 0 ? Math.round((count / total) * 100) : 0;
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-sm">
        <span className="font-medium">{label}</span>
        <span className="tabular-nums">{count} · {pct}%</span>
      </div>
      <div className="h-2 w-full rounded bg-gray-100">
        <div className="h-2 rounded bg-gray-300" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

export default function AnalyticsPanel() {
  if (process.env.NEXT_PUBLIC_ANALYTICS_ENABLED !== "1") {
    return <div className="text-sm text-gray-500">Analytics is disabled (feature flag).</div>;
  }

  const { data: m, isLoading: mL } = useSWR<MembersAnalytics>("/api/analytics/members", jsonFetcher, { refreshInterval: 30000 });
  const { data: inv, isLoading: iL } = useSWR<InvitationsAnalytics>("/api/analytics/invitations?days=30", jsonFetcher, { refreshInterval: 30000 });
  const { data: au, isLoading: aL } = useSWR<AuditAnalytics>("/api/analytics/audit?days=30", jsonFetcher, { refreshInterval: 30000 });

  const loading = mL || iL || aL;

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">Analytics (last 30 days)</h2>
        <span className="text-xs text-gray-500">{loading ? "Refreshing…" : "Auto-refresh every 30s"}</span>
      </div>

      {/* Members */}
      <section className="space-y-4">
        <h3 className="text-lg font-medium">Members</h3>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <TinyStat label="Total members" value={m?.total ?? 0} />
          <TinyStat label="Approved" value={m?.byStatus?.approved ?? 0} />
          <TinyStat label="Pending" value={m?.byStatus?.pending ?? 0} />
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <TextBar label="Owners" count={m?.byRole?.owner ?? 0} total={m?.total ?? 0} />
          <TextBar label="Admins" count={m?.byRole?.admin ?? 0} total={m?.total ?? 0} />
          <TextBar label="Members" count={m?.byRole?.member ?? 0} total={m?.total ?? 0} />
        </div>
      </section>

      {/* Invitations */}
      <section className="space-y-4">
        <h3 className="text-lg font-medium">Invitations (30d)</h3>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <TinyStat label="Total invitations" value={inv?.total ?? 0} />
          <TinyStat
            label="New (last 7d)"
            value={
              inv?.series
                ?.filter(s => new Date(s.date).getTime() >= Date.now() - 7*24*60*60*1000)
                .reduce((acc, s) => acc + s.pending + s.accepted, 0) ?? 0
            }
          />
          <TinyStat
            label="Accepted (30d)"
            value={inv?.series?.reduce((acc, s) => acc + s.accepted, 0) ?? 0}
          />
        </div>

        <div className="space-y-3">
          <div className="text-sm text-gray-500">Daily invites (pending + accepted)</div>
          <div className="rounded-xl border p-4">
            {inv?.series?.length
              ? (
                <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
                  {inv.series.map((s) => (
                    <li key={s.date} className="space-y-1">
                      <div className="text-sm font-medium">{s.date}</div>
                      <TextBar label="Pending" count={s.pending} total={Math.max(1, s.pending + s.accepted)} />
                      <TextBar label="Accepted" count={s.accepted} total={Math.max(1, s.pending + s.accepted)} />
                    </li>
                  ))}
                </ul>
              )
              : <div className="text-sm text-gray-500">No invitation activity.</div>
            }
          </div>
        </div>
      </section>

      {/* Audit */}
      <section className="space-y-4">
        <h3 className="text-lg font-medium">Audit (30d)</h3>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <TinyStat
            label="Total events (30d)"
            value={au?.series?.reduce((acc, s) => acc + s.count, 0) ?? 0}
          />
          <TinyStat label="Top action" value={(au?.actions?.[0]?.action ?? "–")} />
          <TinyStat label="Top action count" value={(au?.actions?.[0]?.count ?? 0)} />
        </div>

        <div className="space-y-3">
          <div className="text-sm text-gray-500">Top actions</div>
          <div className="rounded-xl border p-4">
            {au?.actions?.length
              ? (
                <ul className="space-y-3">
                  {au.actions.map(a => (
                    <li key={a.action}>
                      <TextBar label={a.action} count={a.count} total={Math.max(1, au.actions[0].count)} />
                    </li>
                  ))}
                </ul>
              )
              : <div className="text-sm text-gray-500">No audit activity.</div>
            }
          </div>
        </div>
      </section>
    </div>
  );
}













