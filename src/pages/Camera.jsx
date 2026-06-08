import { useCallback, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { CameraSource } from "@capacitor/camera";
import { captureNativePhoto, isNativeCameraAvailable } from "@/lib/nativeCamera";
import { ALLOWED_IMAGE_ACCEPT } from "@/lib/uploadPolicy";

export default function Camera() {
  const isNative = isNativeCameraAvailable();
  const navigate = useNavigate();
  const fileInputRef = useRef(null);
  const [error, setError] = useState("");

  const goToUpload = useCallback(
    (file, preview) => {
      navigate("/upload", {
        state: { recordedFile: file, recordedPreview: preview, recordedType: "image" },
      });
    },
    [navigate]
  );

  const handleNativeCapture = async (source = CameraSource.Camera) => {
    try {
      setError("");
      const media = await captureNativePhoto(source);
      goToUpload(media.file, media.preview);
    } catch (err) {
      setError(err.message || "Could not capture photo.");
    }
  };

  const handleWebFile = (e) => {
    const selected = e.target.files?.[0];
    if (!selected) return;
    if (!selected.type.match(/^image\/(jpeg|jpg|png)$/i) && !selected.name.match(/\.(jpe?g|png)$/i)) {
      setError("Only JPG, JPEG, and PNG images are supported.");
      return;
    }
    setError("");
    goToUpload(selected, URL.createObjectURL(selected));
  };

  return (
    <div className="flex flex-col h-[100dvh] bg-black text-white overflow-hidden relative">
      <div className="absolute inset-0 bg-gradient-to-b from-[#111827] via-black to-black flex flex-col items-center justify-center px-6 text-center gap-6">
        <span className="material-symbols-outlined text-[64px] text-[#3b82f6]">photo_camera</span>
        <div>
          <h1 className="text-2xl font-bold">Take a Photo</h1>
          <p className="text-sm text-slate-400 mt-2 max-w-xs">
            Capture or choose a JPG/PNG image for your next post.
          </p>
        </div>

        {error && (
          <p className="text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-2">{error}</p>
        )}

        <div className="w-full max-w-xs flex flex-col gap-3">
          {isNative ? (
            <>
              <button
                type="button"
                onClick={() => handleNativeCapture(CameraSource.Camera)}
                className="w-full py-3 rounded-xl bg-[#3b82f6] text-white font-semibold hover:bg-[#2563eb]"
              >
                Open Camera
              </button>
              <button
                type="button"
                onClick={() => handleNativeCapture(CameraSource.Photos)}
                className="w-full py-3 rounded-xl bg-white/10 text-white font-semibold hover:bg-white/20"
              >
                Choose from Gallery
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="w-full py-3 rounded-xl bg-[#3b82f6] text-white font-semibold hover:bg-[#2563eb]"
              >
                Take or Choose Photo
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept={ALLOWED_IMAGE_ACCEPT}
                capture="environment"
                className="hidden"
                onChange={handleWebFile}
              />
            </>
          )}
          <Link to="/upload" className="text-sm text-slate-400 hover:text-white">
            Or upload from files
          </Link>
        </div>
      </div>

      <header className="absolute top-0 left-0 right-0 px-4 py-6 flex items-center z-10">
        <Link to="/" className="text-white hover:bg-white/10 rounded-full p-2 -ml-2 transition-colors">
          <span className="material-symbols-outlined text-[28px]">close</span>
        </Link>
      </header>
    </div>
  );
}
