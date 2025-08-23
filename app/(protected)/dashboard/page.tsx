import { auth } from "@clerk/nextjs/server";
import OrgSwitcher from "@/components/org-switcher";

export default async function Dashboard() {
  const { userId } = await auth();
  return (
    <main style={{ padding: 24 }}>
      <h2>Dashboard</h2>
      {!userId ? (
        <p>Du må være innlogget.</p>
      ) : (
        <>
          <p>Innlogget som: {userId}</p>
          <div style={{ marginTop: 12 }}>
            <OrgSwitcher />
          </div>
        </>
      )}
    </main>
  );
}


