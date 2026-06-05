import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { CameraSource } from "@capacitor/camera";
import { captureNativePhoto, isNativeCameraAvailable } from "@/lib/nativeCamera";

const DURATIONS = [
  { label: "15s", ms: 15_000 },
  { label: "60s", ms: 60_000 },
  { label: "3m", ms: 180_000 },
];

export default function Camera() {
  const isNative = isNativeCameraAvailable();
  const [isRecording, setIsRecording] = useState(false);
  const [progress, setProgress] = useState(0);
  const [durationMs, setDurationMs] = useState(DURATIONS[1].ms);
  const [facingMode, setFacingMode] = useState("user");
  const [cameraError, setCameraError] = useState("");
  const [cameraReady, setCameraReady] = useState(false);

  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const recorderRef = useRef(null);
  const chunksRef = useRef([]);
  const timerRef = useRef(null);
  const startedAtRef = useRef(0);
  const navigate = useNavigate();

  const stopStream = useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
  }, []);

  const startCamera = useCallback(async () => {
    setCameraError("");
    setCameraReady(false);
    stopStream();

    if (!navigator.mediaDevices?.getUserMedia) {
      setCameraError("Camera is not supported in this browser.");
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode, width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: true,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setCameraReady(true);
    } catch (error) {
      setCameraError(error.message || "Could not access camera.");
    }
  }, [facingMode, stopStream]);

  useEffect(() => {
    if (isNative) return undefined;
    startCamera();
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (recorderRef.current?.state === "recording") recorderRef.current.stop();
      stopStream();
    };
  }, [isNative, startCamera, stopStream]);

  const handleNativeCapture = useCallback(
    async (source = CameraSource.Camera) => {
      try {
        const media = await captureNativePhoto(source);
        navigate("/upload", {
          state: { recordedFile: media.file, recordedPreview: media.preview, recordedType: media.mediaType },
        });
      } catch (error) {
        setCameraError(error.message || "Could not capture image.");
      }
    },
    [navigate]
  );

  const finishRecording = useCallback(
    (blob) => {
      const file = new File([blob], `recording-${Date.now()}.webm`, {
        type: blob.type || "video/webm",
      });
      const preview = URL.createObjectURL(blob);
      navigate("/upload", { state: { recordedFile: file, recordedPreview: preview } });
    },
    [navigate]
  );

  const stopRecording = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    if (recorderRef.current?.state === "recording") {
      recorderRef.current.stop();
    } else {
      setIsRecording(false);
      setProgress(0);
    }
  }, []);

  const startRecording = () => {
    if (!streamRef.current || isRecording) return;

    chunksRef.current = [];
    const mimeType = MediaRecorder.isTypeSupported("video/webm;codecs=vp9")
      ? "video/webm;codecs=vp9"
      : "video/webm";

    const recorder = new MediaRecorder(streamRef.current, { mimeType });
    recorderRef.current = recorder;

    recorder.ondataavailable = (event) => {
      if (event.data.size > 0) chunksRef.current.push(event.data);
    };

    recorder.onstop = () => {
      setIsRecording(false);
      setProgress(0);
      const blob = new Blob(chunksRef.current, { type: mimeType });
      if (blob.size > 0) finishRecording(blob);
    };

    recorder.start(250);
    setIsRecording(true);
    startedAtRef.current = Date.now();

    timerRef.current = setInterval(() => {
      const elapsed = Date.now() - startedAtRef.current;
      const pct = Math.min(100, (elapsed / durationMs) * 100);
      setProgress(pct);
      if (elapsed >= durationMs) stopRecording();
    }, 100);
  };

  const toggleRecording = () => {
    if (isRecording) stopRecording();
    else startRecording();
  };

  const flipCamera = () => {
    if (isRecording) return;
    setFacingMode((prev) => (prev === "user" ? "environment" : "user"));
  };

  return (
    <div className="flex flex-col h-[100dvh] bg-black text-white overflow-hidden relative">
      <div className="absolute inset-0 z-0 overflow-hidden bg-black">
        {isNative ? (
          <div className="absolute inset-0 bg-gradient-to-b from-[#111827] to-black flex flex-col items-center justify-center px-6 text-center gap-5">
            <span className="material-symbols-outlined text-[56px] text-[#3b82f6]">photo_camera</span>
            <h2 className="text-xl font-bold text-white">Native Camera</h2>
            <p className="text-sm text-slate-300 max-w-xs">
              Capture a photo with your device camera, or choose one from your gallery.
            </p>
            <div className="w-full max-w-xs flex flex-col gap-3">
              <button
                type="button"
                onClick={() => handleNativeCapture(CameraSource.Camera)}
                className="w-full py-3 rounded-xl bg-[#3b82f6] text-white font-semibold hover:bg-[#2563eb] transition-colors"
              >
                Capture Photo
              </button>
              <button
                type="button"
                onClick={() => handleNativeCapture(CameraSource.Photos)}
                className="w-full py-3 rounded-xl bg-white/10 text-white font-semibold hover:bg-white/20 transition-colors"
              >
                Choose from Gallery
              </button>
            </div>
          </div>
        ) : (
        <video
          ref={videoRef}
          playsInline
          muted
          className={`w-full h-full object-cover transition-transform duration-500 ${
            isRecording ? "scale-105" : "scale-100"
          } ${facingMode === "user" ? "-scale-x-100" : ""}`}
        />
        )}
        {!isNative && !cameraReady && !cameraError && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/80 text-slate-300 text-sm">
            Starting camera...
          </div>
        )}
        {cameraError && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/90 px-6 text-center gap-3">
            <span className="material-symbols-outlined text-[40px] text-red-400">videocam_off</span>
            <p className="text-sm text-slate-300">{cameraError}</p>
            <button
              type="button"
              onClick={isNative ? () => handleNativeCapture(CameraSource.Camera) : startCamera}
              className="px-4 py-2 rounded-full bg-white/10 text-sm font-semibold hover:bg-white/20"
            >
              Try again
            </button>
            <Link to="/upload" className="text-[#3b82f6] text-sm font-medium">
              Upload from gallery instead
            </Link>
          </div>
        )}
        <div className="absolute top-0 left-0 right-0 h-32 bg-gradient-to-b from-black/60 to-transparent pointer-events-none" />
        <div className="absolute bottom-0 left-0 right-0 h-48 bg-gradient-to-t from-black/80 to-transparent pointer-events-none" />
      </div>

      <header className="absolute top-0 left-0 right-0 px-4 py-6 flex items-center justify-between z-10">
        <Link
          to="/"
          className="text-white drop-shadow-md hover:bg-white/10 rounded-full p-2 -ml-2 transition-colors"
        >
          <span className="material-symbols-outlined text-[28px]">close</span>
        </Link>

        <div className="flex bg-black/40 backdrop-blur-md rounded-full overflow-hidden border border-white/10">
          {DURATIONS.map((d) => (
            <button
              key={d.label}
              type="button"
              disabled={isRecording}
              onClick={() => setDurationMs(d.ms)}
              className={`px-4 py-1.5 text-xs font-semibold transition-colors border-r border-white/10 last:border-r-0 disabled:opacity-50 ${
                durationMs === d.ms ? "bg-white/20" : "hover:bg-white/10"
              }`}
            >
              {d.label}
            </button>
          ))}
        </div>

        <div className="w-10" />
      </header>

      {!isNative && (
        <div className="absolute right-3 top-24 flex flex-col gap-4 z-10 items-center">
          <ToolButton icon="flip_camera_ios" label="Flip" onClick={flipCamera} disabled={isRecording} />
        </div>
      )}

      {!isNative && (
      <div className="absolute bottom-8 left-0 right-0 flex flex-col items-center justify-center z-10 gap-6">
        <div className="relative flex items-center justify-center">
          <svg className="absolute w-[88px] h-[88px] -rotate-90 pointer-events-none">
            <circle cx="44" cy="44" r="41" fill="none" stroke="rgba(255,255,255,0.2)" strokeWidth="4" />
            <motion.circle
              cx="44"
              cy="44"
              r="41"
              fill="none"
              stroke="#ef4444"
              strokeWidth="4"
              strokeDasharray="257"
              strokeDashoffset={257 - (progress / 100) * 257}
              strokeLinecap="round"
            />
          </svg>

          <motion.button
            type="button"
            onClick={toggleRecording}
            disabled={!cameraReady || !!cameraError}
            whileTap={{ scale: 0.9 }}
            className="w-[72px] h-[72px] rounded-full flex items-center justify-center bg-red-500/20 disabled:opacity-40"
          >
            <motion.div
              layout
              animate={{
                borderRadius: isRecording ? "12px" : "50%",
                width: isRecording ? "32px" : "60px",
                height: isRecording ? "32px" : "60px",
                backgroundColor: "#ef4444",
              }}
              transition={{ type: "spring", stiffness: 300, damping: 25 }}
            />
          </motion.button>
        </div>

        <p className="text-xs text-slate-300 drop-shadow-md">
          {isRecording ? "Tap to stop" : "Tap to record"}
        </p>
      </div>
      )}

      <AnimatePresence>
        {!isRecording && (
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            className="absolute bottom-12 right-6 z-10"
          >
            <Link to="/upload" className="flex flex-col items-center gap-1 group">
              <div className="w-10 h-10 rounded-xl overflow-hidden border border-white/20 group-hover:border-white transition-colors bg-white/10 flex items-center justify-center">
                <span className="material-symbols-outlined text-white text-[20px]">upload</span>
              </div>
              <span className="text-[10px] font-semibold text-slate-200 drop-shadow-md">Upload</span>
            </Link>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function ToolButton({ icon, label, onClick, disabled }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="flex flex-col items-center gap-1 group disabled:opacity-40"
    >
      <div className="bg-black/30 backdrop-blur-md p-2.5 rounded-full border border-white/10 group-hover:bg-white/20 transition-colors">
        <span className="material-symbols-outlined text-[22px] text-white drop-shadow-md">{icon}</span>
      </div>
      <span className="text-[10px] font-semibold text-slate-200 drop-shadow-md">{label}</span>
    </button>
  );
}
