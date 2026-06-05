import { Share } from "@capacitor/share";
import { Capacitor } from "@capacitor/core";

export function getAppBaseUrl() {
  const base = import.meta.env.VITE_APP_URL || (typeof window !== "undefined" ? window.location.origin : "");
  return base.replace(/\/$/, "");
}

export async function shareContent({ title = "UBIRT", text, url }) {
  if (Capacitor.isNativePlatform()) {
    await Share.share({
      title,
      text,
      url,
      dialogTitle: "Share",
    });
    return;
  }

  if (typeof navigator !== "undefined" && navigator.share) {
    await navigator.share({ title, text, url });
    return;
  }

  if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(url);
    return { copied: true };
  }

  throw new Error("Sharing is not supported on this device.");
}
