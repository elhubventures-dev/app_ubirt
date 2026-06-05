import { Capacitor } from "@capacitor/core";
import { Microphone } from "@mozartec/capacitor-microphone";

const SETTINGS_HINT =
  "Open your device Settings → Apps → UBIRT → Permissions → Microphone, then allow access.";

export async function ensureMicrophonePermission() {
  if (!Capacitor.isNativePlatform()) {
    return true;
  }

  let status = await Microphone.checkPermissions();
  if (status.microphone === "granted") {
    return true;
  }

  status = await Microphone.requestPermissions();
  if (status.microphone === "granted") {
    return true;
  }

  if (status.microphone === "denied") {
    throw new Error(`Microphone access was denied. ${SETTINGS_HINT}`);
  }

  throw new Error(`Microphone permission is required. ${SETTINGS_HINT}`);
}
