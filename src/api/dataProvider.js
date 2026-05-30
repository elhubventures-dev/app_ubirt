import { mockApi } from "@/api/mockApi";
import { supabaseApi } from "@/api/supabaseApi";
import { isLiveMode, isSupabaseConfigured } from "@/lib/supabaseClient";

const useLive = isLiveMode() && isSupabaseConfigured();

const notConfigured = (featureName = "feature") => {
  throw new Error(
    `Live mode is enabled but Supabase is not configured (${featureName}). Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.`
  );
};

const liveApi = isLiveMode()
  ? useLive
    ? supabaseApi
    : new Proxy(
        {},
        {
          get: (_, prop) => () => notConfigured(String(prop)),
        }
      )
  : null;

export const dataProvider = useLive ? liveApi : mockApi;

export function getDataMode() {
  if (!isLiveMode()) return "mock";
  if (isSupabaseConfigured()) return "live";
  return "live-unconfigured";
}
