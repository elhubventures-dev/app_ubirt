import { createClient } from "@supabase/supabase-js";
import { authenticateClerkRequest, isClerkConfigured } from "../clerkAuth.js";

export function getAdminSupabase() {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    throw new Error("Supabase service role is not configured on the server.");
  }
  return createClient(url, serviceKey, { auth: { persistSession: false } });
}

function authProvider() {
  const explicit = (process.env.VITE_AUTH_PROVIDER || process.env.AUTH_PROVIDER || "").toLowerCase();
  if (explicit === "clerk" || explicit === "supabase") return explicit;
  if (isClerkConfigured() && (process.env.VITE_DATA_BACKEND || "").toLowerCase() === "neon") {
    return "clerk";
  }
  return "supabase";
}

/**
 * Authenticate API request via Clerk (Neon mode) or Supabase JWT (legacy).
 */
export async function authenticateRequest(req) {
  if (authProvider() === "clerk") {
    return authenticateClerkRequest(req);
  }

  const authHeader = req.headers.authorization || "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;
  if (!token) {
    return { error: { status: 401, message: "Missing auth token" } };
  }

  // Allow Clerk tokens even in mixed mode if Supabase verify fails and Clerk is configured
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const anonKey = process.env.VITE_SUPABASE_ANON_KEY;
  if (!url || !anonKey) {
    if (isClerkConfigured()) {
      return authenticateClerkRequest(req);
    }
    return { error: { status: 500, message: "Auth provider is not configured" } };
  }

  const userClient = createClient(url, anonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
  const {
    data: { user },
    error: authError,
  } = await userClient.auth.getUser();

  if (authError || !user) {
    if (isClerkConfigured()) {
      return authenticateClerkRequest(req);
    }
    return { error: { status: 401, message: "Unauthorized" } };
  }

  return { user };
}
