import { put, del, list } from "@vercel/blob";

export function isBlobConfigured() {
  return Boolean(process.env.BLOB_READ_WRITE_TOKEN);
}

export function getStorageProvider() {
  const explicit = (process.env.STORAGE_PROVIDER || process.env.VITE_STORAGE_PROVIDER || "").toLowerCase();
  if (explicit === "blob" || explicit === "supabase") return explicit;
  return isBlobConfigured() ? "blob" : "supabase";
}

/**
 * Upload a binary body to Vercel Blob.
 * @param {string} pathname e.g. uploads/userId/123.jpg
 * @param {ArrayBuffer|Blob|Buffer|ReadableStream|File} body
 * @param {{ contentType?: string, access?: "public" }} options
 */
export async function putBlob(pathname, body, options = {}) {
  if (!isBlobConfigured()) {
    throw new Error("BLOB_READ_WRITE_TOKEN is not configured.");
  }
  const result = await put(pathname, body, {
    access: options.access || "public",
    contentType: options.contentType,
    token: process.env.BLOB_READ_WRITE_TOKEN,
    addRandomSuffix: options.addRandomSuffix ?? false,
  });
  return { url: result.url, pathname: result.pathname };
}

export async function deleteBlob(url) {
  if (!isBlobConfigured()) return;
  await del(url, { token: process.env.BLOB_READ_WRITE_TOKEN });
}

export async function listBlobs(prefix) {
  if (!isBlobConfigured()) return { blobs: [] };
  return list({ prefix, token: process.env.BLOB_READ_WRITE_TOKEN });
}
