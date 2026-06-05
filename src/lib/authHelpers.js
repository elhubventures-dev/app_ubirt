import { getSupabase } from "@/lib/supabaseClient";
import { SIGNUP_BONUS_COINS } from "@/lib/wallet";

function sanitizeUsername(value) {
  const cleaned = String(value ?? "user")
    .toLowerCase()
    .replace(/[^a-z0-9_]/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 24);
  return cleaned || "user";
}

/** Display name from email signup or Google OAuth metadata. */
export function getAuthDisplayName(authUser) {
  const meta = authUser.user_metadata ?? {};
  return (
    meta.display_name ??
    meta.full_name ??
    meta.name ??
    authUser.email?.split("@")[0] ??
    "User"
  );
}

/** Avatar from profile upload, Google `picture`, or custom metadata. */
export function getAuthAvatarUrl(authUser) {
  const meta = authUser.user_metadata ?? {};
  return meta.avatar_url ?? meta.picture ?? null;
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
    authUser.user_metadata?.username ??
      authUser.user_metadata?.full_name ??
      authUser.email?.split("@")[0]
  );
  const username = `${base}_${authUser.id.replace(/-/g, "").slice(0, 6)}`;

  const { error } = await supabase.from("profiles").insert({
    id: authUser.id,
    username,
    display_name: getAuthDisplayName(authUser),
    avatar_url: getAuthAvatarUrl(authUser),
    coins: SIGNUP_BONUS_COINS,
  });

  if (error && error.code !== "23505") {
    throw error;
  }
}

export { getOAuthRedirectUrl } from "@/lib/platform";
