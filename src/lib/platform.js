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
  const base = import.meta.env.VITE_APP_URL || window.location.origin;
  return `${base.replace(/\/$/, "")}/`;
}

export function isOAuthCallbackUrl(url) {
  if (!url) return false;
  return url.startsWith(`${APP_ID}://`) || url.includes("access_token=") || url.includes("code=");
}
