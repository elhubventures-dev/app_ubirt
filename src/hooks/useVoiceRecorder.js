import { useCallback, useEffect, useRef, useState } from "react";
import { Capacitor } from "@capacitor/core";
import { Microphone } from "@mozartec/capacitor-microphone";
import { ensureMicrophonePermission } from "@/lib/microphonePermission";

const MAX_DURATION_MS = 120_000;

function getSupportedMimeType() {
  if (typeof MediaRecorder === "undefined") return "";
  const types = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/ogg"];
  return types.find((type) => MediaRecorder.isTypeSupported(type)) ?? "";
}

function formatDuration(ms) {
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

function base64ToBlob(base64, mimeType) {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return new Blob([bytes], { type: mimeType || "audio/aac" });
}

export function useVoiceRecorder() {
  const [status, setStatus] = useState("idle");
  const [durationMs, setDurationMs] = useState(0);
  const [blob, setBlob] = useState(null);
  const recorderRef = useRef(null);
  const streamRef = useRef(null);
  const chunksRef = useRef([]);
  const timerRef = useRef(null);
  const mimeTypeRef = useRef("");
  const nativeRecordingRef = useRef(false);
  const stopNativeRecordingRef = useRef(null);

  const cleanupStream = useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
  }, []);

  const clearTimer = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const reset = useCallback(() => {
    clearTimer();
    cleanupStream();
    recorderRef.current = null;
    chunksRef.current = [];
    nativeRecordingRef.current = false;
    setBlob(null);
    setDurationMs(0);
    setStatus("idle");
  }, [cleanupStream, clearTimer]);

  const startTimer = useCallback((onMaxDuration) => {
    timerRef.current = window.setInterval(() => {
      setDurationMs((current) => {
        const next = current + 100;
        if (next >= MAX_DURATION_MS) {
          onMaxDuration?.();
          clearTimer();
          return MAX_DURATION_MS;
        }
        return next;
      });
    }, 100);
  }, [clearTimer]);

  const stopNativeRecording = useCallback(async () => {
    if (!nativeRecordingRef.current) return;
    clearTimer();
    nativeRecordingRef.current = false;

    try {
      const result = await Microphone.stopRecording();
      const recorded = base64ToBlob(result.base64String, result.mimeType || "audio/aac");
      const duration = result.duration ?? 0;
      setDurationMs(duration > 0 ? duration : 0);
      setBlob(recorded.size > 0 ? recorded : null);
      setStatus(recorded.size > 0 ? "preview" : "idle");
    } catch {
      setBlob(null);
      setStatus("idle");
      throw new Error("Failed to save the voice recording.");
    }
  }, [clearTimer]);

  stopNativeRecordingRef.current = stopNativeRecording;

  const startNativeRecording = useCallback(async () => {
    await ensureMicrophonePermission();
    await Microphone.startRecording();
    nativeRecordingRef.current = true;
    setStatus("recording");
    setDurationMs(0);
    startTimer(() => {
      stopNativeRecordingRef.current?.();
    });
  }, [startTimer]);

  const startWebRecording = useCallback(async () => {
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
      throw new Error("Voice recording is not supported on this device.");
    }

    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    streamRef.current = stream;
    mimeTypeRef.current = getSupportedMimeType();

    const recorder = mimeTypeRef.current
      ? new MediaRecorder(stream, { mimeType: mimeTypeRef.current })
      : new MediaRecorder(stream);

    chunksRef.current = [];
    recorder.ondataavailable = (event) => {
      if (event.data.size > 0) chunksRef.current.push(event.data);
    };
    recorder.onstop = () => {
      const type = mimeTypeRef.current || recorder.mimeType || "audio/webm";
      const recorded = new Blob(chunksRef.current, { type });
      setBlob(recorded.size > 0 ? recorded : null);
      setStatus(recorded.size > 0 ? "preview" : "idle");
      cleanupStream();
    };

    recorderRef.current = recorder;
    recorder.start(200);
    setStatus("recording");
    setDurationMs(0);
    startTimer(() => {
      recorderRef.current?.stop();
    });
  }, [cleanupStream, startTimer]);

  const startRecording = useCallback(async () => {
    reset();

    if (Capacitor.isNativePlatform()) {
      await startNativeRecording();
      return;
    }

    await ensureMicrophonePermission();
    await startWebRecording();
  }, [reset, startNativeRecording, startWebRecording]);

  const stopRecording = useCallback(async () => {
    if (status !== "recording") return;
    clearTimer();

    if (nativeRecordingRef.current) {
      await stopNativeRecording();
      return;
    }

    recorderRef.current?.stop();
  }, [clearTimer, status, stopNativeRecording]);

  const cancelRecording = useCallback(async () => {
    if (status === "recording") {
      clearTimer();
      chunksRef.current = [];

      if (nativeRecordingRef.current) {
        nativeRecordingRef.current = false;
        try {
          await Microphone.stopRecording();
        } catch {
          // Ignore cleanup errors when cancelling.
        }
      } else {
        recorderRef.current?.stop();
      }
    }
    reset();
  }, [clearTimer, reset, status]);

  useEffect(() => () => reset(), [reset]);

  return {
    status,
    durationMs,
    durationLabel: formatDuration(durationMs),
    blob,
    isRecording: status === "recording",
    hasPreview: status === "preview" && Boolean(blob),
    startRecording,
    stopRecording,
    cancelRecording,
    reset,
  };
}
