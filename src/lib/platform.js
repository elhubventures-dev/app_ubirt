import { Capacitor } from "@capacitor/core";
import { getAppBaseUrl } from "@/lib/apiBase";

export const APP_ID = "ubirtai.app";
export const NATIVE_OAUTH_PATH = "login";
export const NATIVE_OAUTH_REDIRECT = `${APP_ID}://${NATIVE_OAUTH_PATH}`;
export const NATIVE_OAUTH_BRIDGE = "/oauth-return.html";

export function isNativePlatform() {
  return Capacitor.isNativePlatform();
}

export function getNativePlatform() {
  return Capacitor.getPlatform();
}

/** HTTPS bridge page in the OAuth browser tab → deep link back into the app. */
export function getNativeOAuthBridgeUrl() {
  return `${getAppBaseUrl()}${NATIVE_OAUTH_BRIDGE}`;
}

/** Base URL for auth redirects — custom scheme on native, web URL otherwise. */
export function getOAuthRedirectUrl() {
  const platform = getNativePlatform();
  if (platform === "ios" || platform === "android") {
    return NATIVE_OAUTH_REDIRECT;
  }
  // Always return to the same host the user started on (avoids www vs apex PKCE mismatch).
  if (typeof window !== "undefined" && window.location?.origin) {
    return `${window.location.origin}/`;
  }
  const base = import.meta.env.VITE_APP_URL || "";
  return `${base.replace(/\/$/, "")}/`;
}

export function isNativeOAuthBridgeUrl(url) {
  if (!url) return false;
  return url.includes(NATIVE_OAUTH_BRIDGE);
}

/** OAuth callback still in the URL (PKCE code or implicit tokens). */
export function hasPendingWebOAuth() {
  if (typeof window === "undefined") return false;
  const { search, hash } = window.location;
  return search.includes("code=") || hash.includes("access_token=");
}

/** Native app received a web-style OAuth callback in the WebView (misconfigured redirect). */
export function hasNativeWebviewOAuthCallback() {
  if (!isNativePlatform() || typeof window === "undefined") return false;
  return hasPendingWebOAuth();
}

export function isOAuthCallbackUrl(url) {
  if (!url) return false;
  if (url.startsWith(`${APP_ID}://`)) return true;
  if (isNativeOAuthBridgeUrl(url) && (url.includes("code=") || url.includes("access_token="))) {
    return true;
  }
  return url.includes("access_token=") || url.includes("code=");
}
