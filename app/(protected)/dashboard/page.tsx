import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { createNeonClient } from "../../../lib/neon/client";

export default async function Dashboard() {
  const { userId } = await auth();
  if (!userId) {
    redirect("/sign-in");
  }

  return (
    <main style={{ padding: 24 }}>
      <h2>Dashboard</h2>
      <p>Kun innloggede brukere ser dette. Din userId: {userId}</p>
      {/* Eksempel: veldig enkel ping mot Neon database for å verifisere tilkobling */}
      {/* Denne kan byttes ut med faktisk data senere */}
      {await (async () => {
        try {
          const client = createNeonClient();
          const result = await client.query('SELECT NOW() as current_time');
          await client.end();
          return <pre>Neon database ping OK: {result.rows[0]?.current_time}</pre>;
        } catch (e: unknown) {
          return <pre>Neon database ping failed: {e instanceof Error ? e.message : "missing config"}</pre>;
        }
      })()}
    </main>
  );
}


