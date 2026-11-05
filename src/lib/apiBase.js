import { Capacitor } from "@capacitor/core";

const PRODUCTION_APP_URL = "https://www.app.ubirtai.site";

function cleanBaseUrl(url) {
  return String(url || "").replace(/\/$/, "");
}

/** Public site URL used for OAuth callbacks and share links. */
export function getAppBaseUrl() {
  const configured = cleanBaseUrl(import.meta.env.VITE_APP_URL);

  if (Capacitor.isNativePlatform()) {
    if (!configured || /localhost|127\.0\.0\.1/i.test(configured)) {
      return PRODUCTION_APP_URL;
    }
    return configured;
  }

  if (configured) return configured;
  if (typeof window !== "undefined") return cleanBaseUrl(window.location.origin);
  return PRODUCTION_APP_URL;
}

/**
 * Base URL for serverless API routes.
 * In the browser (local vercel/vite), always use the current origin so Blob/Neon/Ably
 * hit the same host/port as the page (e.g. localhost:3030), not VITE_APP_URL.
 * Native apps use the configured production URL.
 */
export function getApiBaseUrl() {
  if (Capacitor.isNativePlatform()) {
    return getAppBaseUrl();
  }
  if (typeof window !== "undefined" && window.location?.origin) {
    return cleanBaseUrl(window.location.origin);
  }
  return getAppBaseUrl();
}

export function getApiUrl(path) {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  const base = getApiBaseUrl();
  return base ? `${base}${normalizedPath}` : normalizedPath;
}
