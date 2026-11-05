import { mockApi } from "@/api/mockApi";
import { supabaseApi } from "@/api/supabaseApi";
import { getDataBackend } from "@/lib/platformConfig";

/**
 * Live data API. In Neon cutover mode, supabaseApi uses getDataClient() → Neon REST
 * plus Ably for realtime and Blob for storage (via env flags).
 */
export const dataProvider =
  getDataBackend() === "mock" ? mockApi : supabaseApi;

export function getDataMode() {
  const backend = getDataBackend();
  if (backend === "neon") return "neon";
  if (backend === "supabase") return "live";
  return "mock";
}

/** @deprecated alias — same object as dataProvider when backend is neon */
export const neonApi = supabaseApi;
