import { getAuthProvider } from "@/lib/platformConfig";
import { getSupabase, isSupabaseConfigured } from "@/lib/supabaseClient";

/**
 * Resolve a Bearer token for /api/* calls (Supabase JWT or Clerk session token).
 */
export async function getAccessToken() {
  const provider = getAuthProvider();

  if (provider === "clerk") {
    // Clerk exposes getToken via window bridge set by ClerkAuthBridge
    const getter = typeof window !== "undefined" ? window.__ubirtGetClerkToken : null;
    if (typeof getter === "function") {
      const token = await getter();
      if (token) return token;
    }
    return null;
  }

  if (isSupabaseConfigured()) {
    const {
      data: { session },
    } = await getSupabase().auth.getSession();
    return session?.access_token ?? null;
  }

  return null;
}
