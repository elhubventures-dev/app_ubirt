import { createClient } from "@supabase/supabase-js";
import { Capacitor } from "@capacitor/core";
import { getDataBackend } from "@/lib/platformConfig";
import { createNeonDataClient } from "@/lib/neonDataClient";

const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

let supabaseClient = null;
let neonClient = null;

export function isSupabaseConfigured() {
  return Boolean(url && anonKey);
}

export function getSupabase() {
  if (!isSupabaseConfigured()) {
    throw new Error(
      "Supabase is not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in .env.local"
    );
  }
  if (!supabaseClient) {
    supabaseClient = createClient(url, anonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: !Capacitor.isNativePlatform(),
        flowType: "pkce",
        storageKey: "ubirt-auth",
      },
    });
  }
  return supabaseClient;
}

/**
 * Data client used by supabaseApi / neon cutover.
 * Neon mode returns a PostgREST-shaped client over /api/neon/rest.
 */
export function getDataClient() {
  if (getDataBackend() === "neon") {
    if (!neonClient) neonClient = createNeonDataClient();
    return neonClient;
  }
  return getSupabase();
}

export function isLiveMode() {
  const backend = getDataBackend();
  return backend === "supabase" || backend === "neon";
}
