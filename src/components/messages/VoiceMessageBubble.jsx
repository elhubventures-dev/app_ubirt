import { useEffect, useRef, useState } from "react";

function formatTime(seconds) {
  if (!Number.isFinite(seconds)) return "0:00";
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

  return (
    <div className="flex items-center gap-3 min-w-[180px]" onClick={(e) => e.stopPropagation()}>
      <button
        type="button"
        onClick={togglePlay}
        className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 ${
          isMe ? "bg-white/20 hover:bg-white/30" : "bg-white/10 hover:bg-white/15"
        }`}
        aria-label={playing ? "Pause voice message" : "Play voice message"}
      >
        <span className="material-symbols-outlined text-[20px]">
          {playing ? "pause" : "play_arrow"}
        </span>
      </button>
      <div className="flex-1 min-w-0">
        <div className={`h-1.5 rounded-full overflow-hidden ${isMe ? "bg-white/20" : "bg-white/10"}`}>
          <div
            className={`h-full rounded-full transition-all ${isMe ? "bg-white" : "bg-[#3b82f6]"}`}
            style={{ width: `${progress}%` }}
          />
        </div>
        <p className={`text-[11px] mt-1 ${isMe ? "text-blue-100" : "text-slate-400"}`}>
          {formatTime(playing || current > 0 ? current : duration)}
        </p>
      </div>
      <audio ref={audioRef} src={url} preload="metadata" className="hidden" />
    </div>
  );
}
