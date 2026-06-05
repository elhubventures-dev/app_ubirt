import { useCallback, useEffect, useRef, useState } from "react";

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

export function useVoiceRecorder() {
  const [status, setStatus] = useState("idle");
  const [durationMs, setDurationMs] = useState(0);
  const [blob, setBlob] = useState(null);
  const recorderRef = useRef(null);
  const streamRef = useRef(null);
  const chunksRef = useRef([]);
  const timerRef = useRef(null);
  const mimeTypeRef = useRef("");

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
    setBlob(null);
    setDurationMs(0);
    setStatus("idle");
  }, [cleanupStream, clearTimer]);

  const startRecording = useCallback(async () => {
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
      throw new Error("Voice recording is not supported on this device.");
    }

    reset();
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

    timerRef.current = window.setInterval(() => {
      setDurationMs((current) => {
        const next = current + 100;
        if (next >= MAX_DURATION_MS) {
          recorderRef.current?.stop();
          clearTimer();
          return MAX_DURATION_MS;
        }
        return next;
      });
    }, 100);
  }, [cleanupStream, clearTimer, reset]);

  const stopRecording = useCallback(() => {
    if (status !== "recording") return;
    clearTimer();
    recorderRef.current?.stop();
  }, [clearTimer, status]);

  const cancelRecording = useCallback(() => {
    if (status === "recording") {
      clearTimer();
      chunksRef.current = [];
      recorderRef.current?.stop();
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
