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

/** Base URL for serverless API routes. Native apps always hit the deployed backend. */
export function getApiBaseUrl() {
  return getAppBaseUrl();
}

export function getApiUrl(path) {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  const base = getApiBaseUrl();
  return base ? `${base}${normalizedPath}` : normalizedPath;
}
