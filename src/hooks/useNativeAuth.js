import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { App } from "@capacitor/app";
import { Browser } from "@capacitor/browser";
import { Capacitor } from "@capacitor/core";
import { getSupabase } from "@/lib/supabaseClient";
import { isOAuthCallbackUrl } from "@/lib/platform";

function parseOAuthCallback(url) {
  if (!url) return null;

  try {
    const parsed = new URL(url.replace(/^([a-z][\w+.-]*):\/\//i, "capacitor://"));
    const errorDescription = parsed.searchParams.get("error_description") || parsed.searchParams.get("error");
    if (errorDescription) {
      return { type: "error", message: decodeURIComponent(errorDescription.replace(/\+/g, " ")) };
    }

    const code = parsed.searchParams.get("code");
    if (code) {
      return { type: "code", value: code };
    }
  } catch {
    // Fall through to regex parsing for non-standard deep links.
  }

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
  if (!isOAuthCallbackUrl(url)) return { completed: false };

  const supabase = getSupabase();
  const callback = parseOAuthCallback(url);
  if (!callback) return { completed: false };
  if (callback.type === "error") {
    throw new Error(callback.message || "Google sign-in was cancelled.");
  }

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

  const {
    data: { session },
    error: sessionError,
  } = await supabase.auth.getSession();
  if (sessionError) throw sessionError;
  if (!session?.user) {
    throw new Error("Sign-in completed but no session was created. Please try again.");
  }

  await Browser.close().catch(() => {});
  return { completed: true };
}

/** Handles OAuth deep-link returns on iOS/Android (PKCE + implicit). */
export function useNativeAuth() {
  const navigate = useNavigate();

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return undefined;

    const finishOAuth = async (url) => {
      try {
        const { completed } = await completeOAuthFromUrl(url);
        if (completed) {
          navigate("/", { replace: true });
        }
      } catch (error) {
        console.error("OAuth deep link failed:", error);
        window.dispatchEvent(
          new CustomEvent("ubirt:native-oauth-error", {
            detail: { message: error.message || "Google sign-in failed." },
          })
        );
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
