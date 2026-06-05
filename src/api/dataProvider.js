import { mockApi } from "@/api/mockApi";
import { supabaseApi } from "@/api/supabaseApi";
import { isSupabaseConfigured } from "@/lib/supabaseClient";

/** Prefer live Supabase API whenever credentials are configured. */
export const dataProvider = isSupabaseConfigured() ? supabaseApi : mockApi;

export function getDataMode() {
  return isSupabaseConfigured() ? "live" : "mock";
}
