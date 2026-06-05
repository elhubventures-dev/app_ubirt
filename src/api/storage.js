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
  validateImageFile(file);
  const supabase = getSupabase();
  const ext = file.name.split(".").pop()?.toLowerCase() ?? "jpg";
  const path = `${userId}/${Date.now()}.${ext}`;
  const { error } = await supabase.storage.from("avatars").upload(path, file, {
    cacheControl: "3600",
    upsert: false,
  });
  if (error) throw error;
  const { data } = supabase.storage.from("avatars").getPublicUrl(path);
  return data.publicUrl;
}

const VOICE_MIME_TYPES = new Set([
  "audio/webm",
  "audio/webm;codecs=opus",
  "audio/mp4",
  "audio/mpeg",
  "audio/ogg",
  "audio/wav",
]);

export async function uploadVoiceFile(file, userId, chatId) {
  const mime = file.type || "audio/webm";
  const baseMime = mime.split(";")[0].trim();
  if (!VOICE_MIME_TYPES.has(baseMime) && !baseMime.startsWith("audio/")) {
    throw new Error("Unsupported voice format.");
  }
  const supabase = getSupabase();
  const ext = mime.includes("mp4") ? "m4a" : mime.includes("ogg") ? "ogg" : mime.includes("mpeg") ? "mp3" : "webm";
  const path = `${userId}/voice/${chatId}/${Date.now()}.${ext}`;

  const { error } = await supabase.storage.from("uploads").upload(path, file, {
    cacheControl: "3600",
    upsert: false,
    contentType: mime,
  });
  if (error) throw error;

  const { data } = supabase.storage.from("uploads").getPublicUrl(path);
  return { path, publicUrl: data.publicUrl };
}

export async function uploadCover(file, userId) {
  validateImageFile(file);
  const supabase = getSupabase();
  const ext = file.name.split(".").pop()?.toLowerCase() ?? "jpg";
  const path = `${userId}/cover-${Date.now()}.${ext}`;
  const { error } = await supabase.storage.from("avatars").upload(path, file, {
    cacheControl: "3600",
    upsert: false,
  });
  if (error) throw error;
  const { data } = supabase.storage.from("avatars").getPublicUrl(path);
  return data.publicUrl;
}
