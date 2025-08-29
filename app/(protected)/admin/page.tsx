import React from "react";

type Tab = "members" | "domains" | "invitations" | "audit" | "profile";

async function fetchJSON(url: string) {
  try {
    // Use absolute URL if relative, otherwise use as-is
    const fullUrl = url.startsWith('http') ? url : `${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}${url}`;
    const r = await fetch(fullUrl, { cache: "no-store" });
    if (!r.ok) throw new Error(`${r.status} ${r.statusText}`);
    return await r.json();
  } catch (e) {
    return { error: String(e) };
  }
}

export default async function AdminPage() {
  // Server Component – henter minst mulig, viser "lazy" klient-komponenter senere om ønskelig
  // Du kan bytte til client-side SWR/React Query senere.
  const [memberships, domains, invitations, audit] = await Promise.all([
    fetchJSON("/api/memberships").catch(()=>null),
    fetchJSON("/api/org-domains").catch(()=>null),
    fetchJSON("/api/invitations").catch(()=>null),
    fetchJSON("/api/audit").catch(()=>null),
  ]);

  const TabButton = ({ id, label }: { id: Tab; label: string }) => (
    <a href={`#${id}`} className="px-3 py-2 rounded-lg border hover:bg-gray-50">
      {label}
    </a>
  );

  const Panel = ({ id, children }: { id: Tab; children: React.ReactNode }) => (
    <section id={id} className="rounded-2xl border p-4 bg-white shadow-sm">
      {children}
    </section>
  );

  const Pretty = ({ data }: { data: any }) => (
    <pre className="text-sm overflow-auto bg-gray-50 rounded-lg p-3 border">{JSON.stringify(data, null, 2)}</pre>
  );

  return (
    <div className="mx-auto max-w-5xl p-6 space-y-6">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold">Admin</h1>
        <p className="text-gray-500">RLS-guarded admin panel (read-only først – trygge POST-er er bak API-ene).</p>
      </header>

      <nav className="flex gap-2 sticky top-0 bg-white/70 backdrop-blur z-10 py-2">
        <TabButton id="members" label="Members" />
        <TabButton id="domains" label="Org domains" />
        <TabButton id="invitations" label="Invitations" />
        <TabButton id="audit" label="Audit" />
        <TabButton id="profile" label="Profile" />
      </nav>

      <div className="grid gap-6">
        <Panel id="members">
          <h2 className="text-lg font-medium mb-2">Members</h2>
          <Pretty data={memberships ?? { note: "GET /api/memberships (auth required)" }} />
        </Panel>

        <Panel id="domains">
          <h2 className="text-lg font-medium mb-2">Org domains</h2>
          <Pretty data={domains ?? { note: "GET /api/org-domains (auth required)" }} />
        </Panel>

        <Panel id="invitations">
          <h2 className="text-lg font-medium mb-2">Invitations</h2>
          <Pretty data={invitations ?? { note: "GET /api/invitations (auth required)" }} />
        </Panel>

        <Panel id="audit">
          <h2 className="text-lg font-medium mb-2">Audit (read-only)</h2>
          <Pretty data={audit ?? { note: "GET /api/audit (auth required)" }} />
        </Panel>

        <Panel id="profile">
          <h2 className="text-lg font-medium mb-2">Profile (coming soon)</h2>
          <ul className="list-disc ml-5 text-gray-600">
            <li>Vis MFA-status (fra Clerk / din egen users-tabell)</li>
            <li>Mulighet for å slå på/av "Require MFA" pr org (policy-styrt)</li>
          </ul>
        </Panel>
      </div>
    </div>
  );
}
