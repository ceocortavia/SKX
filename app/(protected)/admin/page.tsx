import { auth } from "@clerk/nextjs/server";
import OrgSwitcher from "@/components/org-switcher";

async function fetchJson(path: string) {
  const res = await fetch(path, { cache: 'no-store' });
  if (!res.ok) return { error: `${res.status}` } as any;
  return res.json();
}

export default async function AdminPage() {
  const { userId } = await auth();
  const [domains, invites, events] = await Promise.all([
    fetchJson('/api/org-domains'),
    fetchJson('/api/invitations'),
    fetchJson('/api/audit'),
  ]);
  return (
    <main style={{ padding: 24 }}>
      <h2>Admin</h2>
      {!userId ? (
        <p>Du må være innlogget.</p>
      ) : (
        <>
          <div style={{ marginBottom: 12 }}>
            <OrgSwitcher />
          </div>
          <section style={{ marginTop: 16 }}>
            <h3>Domains</h3>
            {domains?.domains?.length ? (
              <ul>
                {domains.domains.map((d: any) => (
                  <li key={d.id}>{d.domain} {d.verified ? '✅' : ''}</li>
                ))}
              </ul>
            ) : <p>Ingen domener eller mangler tilgang.</p>}
          </section>
          <section style={{ marginTop: 16 }}>
            <h3>Invitations</h3>
            {invites?.invitations?.length ? (
              <ul>
                {invites.invitations.map((i: any) => (
                  <li key={i.id}>{i.email} ({i.requested_role}) – {i.status}</li>
                ))}
              </ul>
            ) : <p>Ingen invitasjoner eller mangler tilgang.</p>}
          </section>
          <section style={{ marginTop: 16 }}>
            <h3>Audit (siste 20)</h3>
            {events?.events?.length ? (
              <ul>
                {events.events.map((e: any) => (
                  <li key={e.id}>{e.created_at} – {e.action}</li>
                ))}
              </ul>
            ) : <p>Ingen hendelser eller mangler tilgang.</p>}
          </section>
        </>
      )}
    </main>
  );
}


