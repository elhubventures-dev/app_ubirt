import { useEffect } from "react";
import { App } from "@capacitor/app";
import { Browser } from "@capacitor/browser";
import { Capacitor } from "@capacitor/core";
import { getSupabase } from "@/lib/supabaseClient";
import { isOAuthCallbackUrl } from "@/lib/platform";

async function completeOAuthFromUrl(url) {
  if (!isOAuthCallbackUrl(url)) return false;

  const supabase = getSupabase();

  const codeMatch = url.match(/[?&]code=([^&#]+)/);
  if (codeMatch?.[1]) {
    const { error } = await supabase.auth.exchangeCodeForSession(codeMatch[1]);
    if (error) throw error;
    await Browser.close().catch(() => {});
    return true;
  }

  const hashPart = url.split("#")[1];
  if (hashPart) {
    const params = new URLSearchParams(hashPart);
    const access_token = params.get("access_token");
    const refresh_token = params.get("refresh_token");
    if (access_token && refresh_token) {
      const { error } = await supabase.auth.setSession({ access_token, refresh_token });
      if (error) throw error;
      await Browser.close().catch(() => {});
      return true;
    }
  }

  return false;
}

/** Handles OAuth deep-link returns on iOS/Android (PKCE + implicit). */
export function useNativeAuth() {
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return undefined;

    App.getLaunchUrl()
      .then((launch) => {
        if (launch?.url) return completeOAuthFromUrl(launch.url);
        return false;
      })
      .catch((error) => console.warn("Launch URL check failed:", error));

    const listener = App.addListener("appUrlOpen", async ({ url }) => {
      try {
        await completeOAuthFromUrl(url);
      } catch (error) {
        console.error("OAuth deep link failed:", error);
      }
    });

    return () => {
      listener.then((handle) => handle.remove());
    };
  }, []);
}
