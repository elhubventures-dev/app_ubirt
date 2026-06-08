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

export function AppUpdateBanner({ update, onDismiss }) {
  if (!update) return null;

  return (
    <div className="fixed top-[calc(env(safe-area-inset-top)+0.75rem)] left-4 right-4 z-[120] bg-[#1a2332] border border-[#3b82f6]/30 rounded-2xl p-4 shadow-2xl">
      <div className="flex items-start gap-3">
        <span className="material-symbols-outlined text-[#3b82f6] mt-0.5">system_update</span>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-white">Update available</p>
          <p className="text-xs text-slate-400 mt-1">{update.message}</p>
          <p className="text-[10px] text-slate-500 mt-1">
            Installed {update.current} · Latest {update.latest}
          </p>
        </div>
        <button type="button" onClick={onDismiss} className="text-slate-500 hover:text-white p-1">
          <span className="material-symbols-outlined text-[18px]">close</span>
        </button>
      </div>
      {update.storeUrl ? (
        <a
          href={update.storeUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-3 block w-full text-center py-2.5 rounded-xl bg-[#3b82f6] text-white text-sm font-semibold"
        >
          Open store
        </a>
      ) : null}
    </div>
  );
}
