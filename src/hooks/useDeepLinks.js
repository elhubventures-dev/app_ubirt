import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { App } from "@capacitor/app";
import { Capacitor } from "@capacitor/core";
import { resolveDeepLink } from "@/lib/deepLinks";
import { isOAuthCallbackUrl } from "@/lib/platform";

/** Navigate to in-app routes from universal links / custom URL opens. */
export function useDeepLinks() {
  const navigate = useNavigate();

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;

    const open = (url) => {
      if (!url || isOAuthCallbackUrl(url)) return;
      const route = resolveDeepLink(url);
      if (route) navigate(route);
    };

    App.getLaunchUrl()
      .then((result) => open(result?.url))
      .catch(() => {});

    let removeListener;
    App.addListener("appUrlOpen", ({ url }) => open(url)).then((handle) => {
      removeListener = () => handle.remove();
    });

    return () => {
      removeListener?.();
    };
  }, [navigate]);
}
