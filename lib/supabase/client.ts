"use client";

import { createClient } from "@supabase/supabase-js";
import { useAuth } from "@clerk/nextjs";

// Oppretter en Supabase-klient i browseren som automatisk legger ved Clerk session token
export function useSupabaseClient() {
  const { getToken } = useAuth();

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL as string | undefined;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY as string | undefined;

  if (!supabaseUrl) {
    throw new Error("NEXT_PUBLIC_SUPABASE_URL mangler");
  }

  const supabase = createClient(supabaseUrl, supabaseAnonKey ?? "anon-key-missing", {
    global: {
      fetch: async (input, init) => {
        const token = await getToken({ template: "supabase" }).catch(() => undefined);
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


