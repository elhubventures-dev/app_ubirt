import { getSupabase } from "@/lib/supabaseClient";
import { validateImageFile } from "@/lib/uploadPolicy";
import { getStorageProvider } from "@/lib/platformConfig";
import { getAccessToken } from "@/lib/authToken";
import { getApiUrl } from "@/lib/apiBase";

const VOICE_MIME_TYPES = new Set([
  "audio/webm",
  "audio/webm;codecs=opus",
  "audio/mp4",
  "audio/aac",
  "audio/mpeg",
  "audio/ogg",
  "audio/wav",
]);

async function fileToBase64(file) {
  const buffer = await file.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

async function uploadViaBlob(file, { kind, chatId } = {}) {
  const token = await getAccessToken();
  if (!token) throw new Error("Not authenticated.");

  const dataBase64 = await fileToBase64(file);
  const res = await fetch(getApiUrl("/api/blob/upload"), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      filename: file.name || "upload.bin",
      contentType: file.type || "application/octet-stream",
      kind: kind || "uploads",
      chatId,
      dataBase64,
    }),
  });

  const payload = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(payload.error || "Blob upload failed");
  }
  return { path: payload.path, publicUrl: payload.publicUrl };
}

/**
 * Upload a file to Supabase Storage `uploads` bucket or Vercel Blob.
 * @returns {{ path: string, publicUrl: string }}
 */
export async function uploadMediaFile(file, userId) {
  validateImageFile(file);

  if (getStorageProvider() === "blob") {
    return uploadViaBlob(file, { kind: "uploads" });
  }

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

  if (getStorageProvider() === "blob") {
    const { publicUrl } = await uploadViaBlob(file, { kind: "avatars" });
    return publicUrl;
  }

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

export async function uploadVoiceFile(file, userId, chatId) {
  const mime = file.type || "audio/webm";
  const baseMime = mime.split(";")[0].trim();
  if (!VOICE_MIME_TYPES.has(baseMime) && !baseMime.startsWith("audio/")) {
    throw new Error("Unsupported voice format.");
  }

  if (getStorageProvider() === "blob") {
    return uploadViaBlob(file, { kind: "voice", chatId });
  }

  const supabase = getSupabase();
  const ext = mime.includes("aac") || mime.includes("mp4")
    ? "m4a"
    : mime.includes("ogg")
      ? "ogg"
      : mime.includes("mpeg")
        ? "mp3"
        : "webm";
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

  if (getStorageProvider() === "blob") {
    const { publicUrl } = await uploadViaBlob(file, { kind: "covers" });
    return publicUrl;
  }

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
