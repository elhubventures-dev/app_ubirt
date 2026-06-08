import { Capacitor } from "@capacitor/core";
import { getPreference } from "@/lib/preferences";

let audioContext = null;
let notifyAudio = null;

function getAudioContext() {
  if (typeof window === "undefined") return null;
  const AudioCtx = window.AudioContext || window.webkitAudioContext;
  if (!AudioCtx) return null;

  if (!audioContext) {
    audioContext = new AudioCtx();
  }
  if (audioContext.state === "suspended") {
    audioContext.resume().catch(() => {});
  }
  return audioContext;
}

function playTone(ctx, frequency, start, duration, volume = 0.12) {
  const oscillator = ctx.createOscillator();
  const gain = ctx.createGain();
  oscillator.type = "sine";
  oscillator.frequency.value = frequency;
  gain.gain.setValueAtTime(0, start);
  gain.gain.linearRampToValueAtTime(volume, start + 0.015);
  gain.gain.exponentialRampToValueAtTime(0.001, start + duration);
  oscillator.connect(gain);
  gain.connect(ctx.destination);
  oscillator.start(start);
  oscillator.stop(start + duration);
}

function playWebAudioTone(variant = "default") {
  const ctx = getAudioContext();
  if (!ctx) return false;

  const now = ctx.currentTime;
  if (variant === "message") {
    playTone(ctx, 740, now, 0.1, 0.1);
    playTone(ctx, 988, now + 0.08, 0.14, 0.1);
    return true;
  }
  playTone(ctx, 880, now, 0.11, 0.12);
  playTone(ctx, 1174.66, now + 0.09, 0.16, 0.1);
  return true;
}

function playBundledSound() {
  if (typeof window === "undefined") return false;
  if (!notifyAudio) {
    notifyAudio = new Audio("/sounds/notify.wav");
    notifyAudio.preload = "auto";
  }
  notifyAudio.currentTime = 0;
  notifyAudio.volume = 1;
  const playPromise = notifyAudio.play();
  if (playPromise?.catch) {
    playPromise.catch(() => playWebAudioTone());
  }
  return true;
}

export function playNotificationSound(variant = "default") {
  if (!getPreference("notificationSound", true)) return;

  try {
    if (Capacitor.isNativePlatform()) {
      playBundledSound();
      return;
    }
    if (!playWebAudioTone(variant)) {
      playBundledSound();
    }
  } catch (error) {
    console.warn("Notification sound failed:", error);
  }
}

if (typeof window !== "undefined") {
  const unlock = () => {
    getAudioContext();
    if (notifyAudio) {
      notifyAudio.load();
    }
  };
  window.addEventListener("pointerdown", unlock, { once: true });
  window.addEventListener("keydown", unlock, { once: true });
}
