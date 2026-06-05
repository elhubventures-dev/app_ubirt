import { Capacitor } from "@capacitor/core";

export const APP_ID = "com.elhubventures.ubirt";
export const NATIVE_OAUTH_PATH = "login";
export const NATIVE_OAUTH_REDIRECT = `${APP_ID}://${NATIVE_OAUTH_PATH}`;

export function isNativePlatform() {
  return Capacitor.isNativePlatform();
}

export function getNativePlatform() {
  return Capacitor.getPlatform();
}

/** Base URL for auth redirects — custom scheme on native, web URL otherwise. */
export function getOAuthRedirectUrl() {
  if (isNativePlatform()) {
    return NATIVE_OAUTH_REDIRECT;
  }
  // Always return to the same host the user started on (avoids www vs apex PKCE mismatch).
  if (typeof window !== "undefined" && window.location?.origin) {
    return `${window.location.origin}/`;
  }
  const base = import.meta.env.VITE_APP_URL || "";
  return `${base.replace(/\/$/, "")}/`;
}

/** Web OAuth callback still in the URL (PKCE code or implicit tokens). */
export function hasPendingWebOAuth() {
  if (isNativePlatform() || typeof window === "undefined") return false;
  const { search, hash } = window.location;
  return search.includes("code=") || hash.includes("access_token=");
}

export function isOAuthCallbackUrl(url) {
  if (!url) return false;
  return url.startsWith(`${APP_ID}://`) || url.includes("access_token=") || url.includes("code=");
}
