import { Haptics, ImpactStyle, NotificationType } from "@capacitor/haptics";
import { Capacitor } from "@capacitor/core";
import { getPreference } from "@/lib/preferences";

export function hapticsEnabled() {
  return getPreference("haptics", true);
}

async function run(action) {
  if (!Capacitor.isNativePlatform() || !hapticsEnabled()) return;
  try {
    await action();
  } catch {
    // Device may not support haptics.
  }
}

export function hapticLight() {
  return run(() => Haptics.impact({ style: ImpactStyle.Light }));
}

export function hapticMedium() {
  return run(() => Haptics.impact({ style: ImpactStyle.Medium }));
}

export function hapticSuccess() {
  return run(() => Haptics.notification({ type: NotificationType.Success }));
}

export function hapticLike() {
  return hapticMedium();
}

export function hapticGift() {
  return run(() => Haptics.notification({ type: NotificationType.Success }));
}

export function hapticMessageSent() {
  return hapticLight();
}
