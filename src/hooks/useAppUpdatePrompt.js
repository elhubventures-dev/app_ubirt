import { useEffect, useState } from "react";
import { App } from "@capacitor/app";
import { Capacitor } from "@capacitor/core";
import { getApiUrl } from "@/lib/apiBase";

function parseVersion(version) {
  return String(version || "0")
    .split(".")
    .map((part) => parseInt(part, 10) || 0);
}

function isNewerVersion(current, minimum) {
  const a = parseVersion(current);
  const b = parseVersion(minimum);
  const len = Math.max(a.length, b.length);
  for (let i = 0; i < len; i += 1) {
    const av = a[i] ?? 0;
    const bv = b[i] ?? 0;
    if (av < bv) return true;
    if (av > bv) return false;
  }
  return false;
}

/** Prompt when a newer store build is available (native only). */
export function useAppUpdatePrompt() {
  const [update, setUpdate] = useState(null);

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;

    let cancelled = false;

    (async () => {
      try {
        const info = await App.getInfo();
        const url = getApiUrl("/app-version.json");
        const res = await fetch(`${url}?t=${Date.now()}`);
        if (!res.ok) return;
        const manifest = await res.json();
        const platform = Capacitor.getPlatform();
        const remote = manifest[platform] || manifest.android || manifest.ios;
        if (!remote?.version) return;

        if (isNewerVersion(info.version, remote.version)) {
          if (!cancelled) {
            setUpdate({
              current: info.version,
              latest: remote.version,
              storeUrl: remote.storeUrl,
              message: remote.message || "A new version of UBIRT is available.",
            });
          }
        }
      } catch {
        // Ignore — update prompt is best-effort.
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  return update;
}
