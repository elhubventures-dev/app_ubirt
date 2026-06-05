import { useEffect } from "react";
import { SplashScreen } from "@capacitor/splash-screen";
import { Capacitor } from "@capacitor/core";
import { useNativeAuth } from "@/hooks/useNativeAuth";

/** Native-only boot: hide splash screen and wire OAuth deep links. */
export function useNativeShell() {
  useNativeAuth();

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;
    SplashScreen.hide().catch(() => {});
  }, []);
}
