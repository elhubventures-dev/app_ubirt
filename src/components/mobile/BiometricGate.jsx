import { useCallback, useEffect, useState } from "react";
import { App } from "@capacitor/app";
import { Capacitor } from "@capacitor/core";
import { BiometricAuth } from "@aparajita/capacitor-biometric-auth";
import { getPreference, setPreference } from "@/lib/preferences";
import { PrimaryButton } from "@/components/ui/PrimaryButton";

export function isBiometricLockEnabled() {
  return getPreference("biometricLock", false);
}

export function setBiometricLockEnabled(value) {
  setPreference("biometricLock", value);
}

/** Face ID / fingerprint gate when returning to the app. */
export default function BiometricGate({ children }) {
  const [locked, setLocked] = useState(false);
  const [available, setAvailable] = useState(false);
  const [error, setError] = useState("");

  const unlock = useCallback(async () => {
    if (!Capacitor.isNativePlatform() || !isBiometricLockEnabled()) {
      setLocked(false);
      return;
    }

    try {
      setError("");
      await BiometricAuth.authenticate({
        reason: "Unlock UBIRT",
        cancelTitle: "Cancel",
        allowDeviceCredential: true,
      });
      setLocked(false);
    } catch (err) {
      setError(err?.message || "Authentication failed");
      setLocked(true);
    }
  }, []);

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;

    BiometricAuth.checkBiometry()
      .then((info) => setAvailable(Boolean(info.isAvailable)))
      .catch(() => setAvailable(false));
  }, []);

  useEffect(() => {
    if (!Capacitor.isNativePlatform() || !isBiometricLockEnabled()) return;

    setLocked(true);
    unlock();

    let removeListener;
    App.addListener("appStateChange", ({ isActive }) => {
      if (isActive && isBiometricLockEnabled()) {
        setLocked(true);
        unlock();
      }
    }).then((handle) => {
      removeListener = () => handle.remove();
    });

    return () => removeListener?.();
  }, [unlock]);

  if (!Capacitor.isNativePlatform() || !isBiometricLockEnabled()) {
    return children;
  }

  return (
    <>
      {children}
      {locked ? (
        <div className="fixed inset-0 z-[200] bg-[#101822]/95 backdrop-blur-xl flex flex-col items-center justify-center px-8 text-center">
          <span className="material-symbols-outlined text-[56px] text-[#3b82f6] mb-4">lock</span>
          <h2 className="text-xl font-bold text-white mb-2">UBIRT is locked</h2>
          <p className="text-sm text-slate-400 mb-6">
            {available ? "Use Face ID or fingerprint to continue." : "Biometrics unavailable on this device."}
          </p>
          {error ? <p className="text-xs text-red-400 mb-4">{error}</p> : null}
          <PrimaryButton className="w-full max-w-xs" onClick={unlock}>
            Unlock
          </PrimaryButton>
        </div>
      ) : null}
    </>
  );
}
