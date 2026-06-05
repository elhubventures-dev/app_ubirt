import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { App } from "@capacitor/app";
import { Browser } from "@capacitor/browser";
import { Capacitor } from "@capacitor/core";
import { getSupabase } from "@/lib/supabaseClient";
import { isOAuthCallbackUrl } from "@/lib/platform";

function parseOAuthCallback(url) {
  if (!url) return null;

  const queryMatch = url.match(/[?&]code=([^&#]+)/);
  if (queryMatch?.[1]) {
    return { type: "code", value: decodeURIComponent(queryMatch[1]) };
  }

  const hashPart = url.split("#")[1];
  if (hashPart) {
    const params = new URLSearchParams(hashPart);
    const access_token = params.get("access_token");
    const refresh_token = params.get("refresh_token");
    if (access_token && refresh_token) {
      return { type: "tokens", access_token, refresh_token };
    }
  }

  return null;
}

async function completeOAuthFromUrl(url) {
  if (!isOAuthCallbackUrl(url)) return false;

  const supabase = getSupabase();
  const callback = parseOAuthCallback(url);
  if (!callback) return false;

  if (callback.type === "code") {
    const { error } = await supabase.auth.exchangeCodeForSession(callback.value);
    if (error) throw error;
  } else {
    const { error } = await supabase.auth.setSession({
      access_token: callback.access_token,
      refresh_token: callback.refresh_token,
    });
    if (error) throw error;
  }

  await Browser.close().catch(() => {});
  return true;
}

/** Handles OAuth deep-link returns on iOS/Android (PKCE + implicit). */
export function useNativeAuth() {
  const navigate = useNavigate();

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return undefined;

    const finishOAuth = async (url) => {
      try {
        const completed = await completeOAuthFromUrl(url);
        if (completed) {
          navigate("/", { replace: true });
        }
      } catch (error) {
        console.error("OAuth deep link failed:", error);
      }
    };

    App.getLaunchUrl()
      .then((launch) => {
        if (launch?.url) return finishOAuth(launch.url);
        return false;
      })
      .catch((error) => console.warn("Launch URL check failed:", error));

    const listener = App.addListener("appUrlOpen", ({ url }) => finishOAuth(url));

    return () => {
      listener.then((handle) => handle.remove());
    };
  }, [navigate]);
}
