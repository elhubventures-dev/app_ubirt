import { uploadMediaFile } from "@/api/storage";
import { validateImageFile } from "@/lib/uploadPolicy";

/** Upload image to Supabase Storage (images only — no video/Mux pipeline). */
export async function processImageUpload(file, userId) {
  validateImageFile(file);
  const { path, publicUrl } = await uploadMediaFile(file, userId);
  return {
    storagePath: path,
    mediaUrl: publicUrl,
    muxAssetId: null,
    muxPlaybackId: null,
  };
}

/** @deprecated Use processImageUpload — kept for imports during transition */
export const processVideoUpload = processImageUpload;

export function isMuxConfigured() {
  return false;
}
