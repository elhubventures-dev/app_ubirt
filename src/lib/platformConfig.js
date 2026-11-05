/**
 * Runtime platform switches for the resilient stack (Neon + Redis + Blob + Clerk + Ably).
 * Default remains Supabase until cutover env flags are set.
 */

export function getDataBackend() {
  const v = (import.meta.env.VITE_DATA_BACKEND || "").toLowerCase();
  if (v === "neon" || v === "supabase" || v === "mock") return v;
  // Legacy: live when Supabase configured
  if (import.meta.env.VITE_SUPABASE_URL && import.meta.env.VITE_SUPABASE_ANON_KEY) {
    return "supabase";
  }
  return "mock";
}

export function getStorageProvider() {
  const v = (import.meta.env.VITE_STORAGE_PROVIDER || "").toLowerCase();
  if (v === "blob" || v === "supabase") return v;
  if (import.meta.env.VITE_BLOB_ENABLED === "true") return "blob";
  return getDataBackend() === "neon" ? "blob" : "supabase";
}

export function getAuthProvider() {
  const v = (import.meta.env.VITE_AUTH_PROVIDER || "").toLowerCase();
  if (v === "clerk" || v === "supabase" || v === "demo") return v;
  if (import.meta.env.VITE_CLERK_PUBLISHABLE_KEY && getDataBackend() === "neon") {
    return "clerk";
  }
  if (import.meta.env.VITE_SUPABASE_URL && import.meta.env.VITE_SUPABASE_ANON_KEY) {
    return "supabase";
  }
  return "demo";
}

export function getRealtimeProvider() {
  const v = (import.meta.env.VITE_REALTIME_PROVIDER || "").toLowerCase();
  if (v === "ably" || v === "supabase" || v === "none") return v;
  if (import.meta.env.VITE_ABLY_KEY && getDataBackend() === "neon") return "ably";
  if (getDataBackend() === "supabase") return "supabase";
  return "none";
}

export function isNeonMode() {
  return getDataBackend() === "neon";
}

export function isClerkAuth() {
  return getAuthProvider() === "clerk";
}
