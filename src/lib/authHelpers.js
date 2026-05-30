import { getSupabase } from "@/lib/supabaseClient";

function sanitizeUsername(value) {
  const cleaned = String(value ?? "user")
    .toLowerCase()
    .replace(/[^a-z0-9_]/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 24);
  return cleaned || "user";
}

/** Create profile row if signup trigger did not run or failed. */
export async function ensureUserProfile(authUser) {
  const supabase = getSupabase();
  const { data: existing } = await supabase
    .from("profiles")
    .select("id")
    .eq("id", authUser.id)
    .maybeSingle();

  if (existing) return;

  const base = sanitizeUsername(
    authUser.user_metadata?.username ?? authUser.email?.split("@")[0]
  );
  const username = `${base}_${authUser.id.replace(/-/g, "").slice(0, 6)}`;

  const { error } = await supabase.from("profiles").insert({
    id: authUser.id,
    username,
    display_name: authUser.user_metadata?.display_name ?? base,
    avatar_url: authUser.user_metadata?.avatar_url ?? null,
  });

  if (error && error.code !== "23505") {
    throw error;
  }
}
