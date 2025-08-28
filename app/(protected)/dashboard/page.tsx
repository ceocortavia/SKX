import { auth } from "@clerk/nextjs/server";
<<<<<<< HEAD
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
=======
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "../../../lib/supabase/server";

export default async function Dashboard() {
  const { userId } = await auth();
  if (!userId) {
    redirect("/sign-in");
  }

  return (
    <main style={{ padding: 24 }}>
      <h2>Dashboard</h2>
      <p>Kun innloggede brukere ser dette. Din userId: {userId}</p>
      {/* Eksempel: veldig enkel ping mot Supabase for å verifisere token-flyt */}
      {/* Denne kan byttes ut med faktisk data senere */}
      {await (async () => {
        try {
          const supabase = await createSupabaseServerClient();
          const { error } = await supabase.from("pg_temp").select("1").limit(1);
          return <pre>{error ? `Supabase ping error: ${error.message}` : "Supabase ping OK"}</pre>;
        } catch (e: unknown) {
          return <pre>{`Supabase ping skipped (${e instanceof Error ? e.message : "missing config"})`}</pre>;
        }
      })()}
>>>>>>> origin/main
    </main>
  );
}


