import { getSupabase } from "@/lib/supabaseClient";
import { validateImageFile } from "@/lib/uploadPolicy";

/**
 * Upload a file to Supabase Storage `uploads` bucket.
 * @returns {{ path: string, publicUrl: string }}
 */
export async function uploadMediaFile(file, userId) {
  validateImageFile(file);
  const supabase = getSupabase();
  const ext = file.name.split(".").pop() ?? "bin";
  const path = `${userId}/${Date.now()}.${ext}`;

  const { error } = await supabase.storage.from("uploads").upload(path, file, {
    cacheControl: "3600",
    upsert: false,
  });
  if (error) throw error;

  const { data } = supabase.storage.from("uploads").getPublicUrl(path);
  return { path, publicUrl: data.publicUrl };
}

export async function uploadAvatar(file, userId) {
  const supabase = getSupabase();
  const path = `${userId}/avatar.${file.name.split(".").pop() ?? "jpg"}`;
  const { error } = await supabase.storage.from("avatars").upload(path, file, { upsert: true });
  if (error) throw error;
  const { data } = supabase.storage.from("avatars").getPublicUrl(path);
  await supabase.from("profiles").update({ avatar_url: data.publicUrl }).eq("id", userId);
  return data.publicUrl;
}
