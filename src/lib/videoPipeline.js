import { uploadMediaFile } from "@/api/storage";

/**
 * Step 7: Upload to Supabase Storage, then optional Mux ingest via serverless API.
 */
export async function processVideoUpload(file, userId) {
  const { path, publicUrl } = await uploadMediaFile(file, userId);

  try {
    const res = await fetch("/api/video/ingest", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url: publicUrl }),
    });
    const json = await res.json();
    if (res.ok && json.playbackUrl) {
      return {
        storagePath: path,
        mediaUrl: json.playbackUrl,
        muxAssetId: json.muxAssetId,
        muxPlaybackId: json.muxPlaybackId,
      };
    }
  } catch {
    // Mux optional — fall back to direct storage URL
  }

  return {
    storagePath: path,
    mediaUrl: publicUrl,
    muxAssetId: null,
    muxPlaybackId: null,
  };
}

export function isMuxConfigured() {
  return true;
}
