import { createClient } from "@supabase/supabase-js";
import { auth } from "@clerk/nextjs/server";

// Server-klient som henter Clerk session token og injiserer i Authorization-headeren mot Supabase
export async function createSupabaseServerClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL as string | undefined;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY as string | undefined;
  if (!supabaseUrl) {
    throw new Error("NEXT_PUBLIC_SUPABASE_URL mangler");
  }

  const { getToken } = await auth();
  const token = await getToken({ template: "supabase" }).catch(() => undefined);

  const supabase = createClient(supabaseUrl, supabaseAnonKey ?? "anon-key-missing", {
    global: {
      fetch: async (input, init) => {
        const headers = new Headers(init?.headers || {});
        if (token) headers.set("Authorization", `Bearer ${token}`);
        return fetch(input, { ...init, headers });
      },
    },
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });

  return supabase;
}


