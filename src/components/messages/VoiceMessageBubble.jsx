import { useEffect, useRef, useState } from "react";

function formatTime(seconds) {
  if (!Number.isFinite(seconds) || seconds < 0) return "0:00";
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${String(secs).padStart(2, "0")}`;
}

export default function VoiceMessageBubble({ url, isMe }) {
  const audioRef = useRef(null);
  const [playing, setPlaying] = useState(false);
  const [duration, setDuration] = useState(0);
  const [current, setCurrent] = useState(0);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return undefined;

    const onLoaded = () => setDuration(audio.duration || 0);
    const onTimeUpdate = () => setCurrent(audio.currentTime || 0);
    const onEnded = () => {
      setPlaying(false);
      setCurrent(0);
    };

    audio.addEventListener("loadedmetadata", onLoaded);
    audio.addEventListener("timeupdate", onTimeUpdate);
    audio.addEventListener("ended", onEnded);
    return () => {
      audio.removeEventListener("loadedmetadata", onLoaded);
      audio.removeEventListener("timeupdate", onTimeUpdate);
      audio.removeEventListener("ended", onEnded);
    };
  }, [url]);

  const togglePlay = async () => {
    const audio = audioRef.current;
    if (!audio) return;
    if (playing) {
      audio.pause();
      setPlaying(false);
      return;
    }
    try {
      await audio.play();
      setPlaying(true);
    } catch {
      setPlaying(false);
    }
  };

  const progress = duration > 0 ? Math.min(100, (current / duration) * 100) : 0;
  const remaining = duration > 0 ? Math.max(0, duration - current) : 0;

  return (
    <div className="flex items-center gap-3 min-w-[200px]" onClick={(e) => e.stopPropagation()}>
      <button
        type="button"
        onClick={togglePlay}
        className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 transition-colors ${
          playing
            ? isMe
              ? "bg-white/35 ring-2 ring-white/50 text-white"
              : "bg-[#3b82f6]/50 ring-2 ring-[#60a5fa]/60 text-[#93c5fd]"
            : isMe
              ? "bg-white/20 hover:bg-white/30 text-white"
              : "bg-white/10 hover:bg-white/15 text-slate-200"
        }`}
        aria-label={playing ? "Pause voice message" : "Play voice message"}
      >
        <span className="material-symbols-outlined text-[20px]">
          {playing ? "pause" : "play_arrow"}
        </span>
      </button>

      <div className="flex-1 min-w-0">
        <div
          className={`h-2 rounded-full overflow-hidden transition-colors ${
            playing
              ? isMe
                ? "bg-white/30"
                : "bg-[#3b82f6]/25"
              : isMe
                ? "bg-white/20"
                : "bg-white/10"
          }`}
        >
          <div
            className={`h-full rounded-full ${
              playing
                ? isMe
                  ? "bg-white shadow-[0_0_10px_rgba(255,255,255,0.45)]"
                  : "bg-[#60a5fa] shadow-[0_0_10px_rgba(96,165,250,0.45)]"
                : isMe
                  ? "bg-white/80"
                  : "bg-[#3b82f6]"
            }`}
            style={{ width: `${progress}%` }}
          />
        </div>

        <div className={`flex items-center justify-between mt-1.5 gap-2 tabular-nums ${isMe ? "text-blue-100" : "text-slate-400"}`}>
          {playing ? (
            <>
              <span className={`text-xs font-semibold ${isMe ? "text-white" : "text-[#93c5fd]"}`}>
                {formatTime(remaining)}
              </span>
              <span className="text-[10px] opacity-70">{formatTime(duration)} total</span>
            </>
          ) : (
            <span className="text-[11px]">{formatTime(duration)}</span>
          )}
        </div>
      </div>

      <audio ref={audioRef} src={url} preload="metadata" className="hidden" />
    </div>
  );
}
