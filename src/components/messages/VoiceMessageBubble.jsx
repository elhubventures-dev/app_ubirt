import { useCallback, useEffect, useRef, useState } from "react";

function formatTime(seconds) {
  if (!Number.isFinite(seconds) || seconds < 0) return "0:00";
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${String(secs).padStart(2, "0")}`;
}

function readDuration(audio) {
  const value = audio?.duration;
  return Number.isFinite(value) && value > 0 ? value : 0;
}

async function resolveAudioDuration(audio, knownDuration = 0) {
  if (knownDuration > 0) return knownDuration;

  const fromMeta = readDuration(audio);
  if (fromMeta > 0) return fromMeta;

  if (!audio.src) return 0;

  return new Promise((resolve) => {
    let settled = false;
    const finish = (value) => {
      if (settled) return;
      settled = true;
      audio.removeEventListener("loadedmetadata", onMeta);
      audio.removeEventListener("durationchange", onMeta);
      audio.removeEventListener("seeked", onSeeked);
      audio.currentTime = 0;
      resolve(value > 0 ? value : 0);
    };

    const onMeta = () => {
      const value = readDuration(audio);
      if (value > 0) finish(value);
    };

    const onSeeked = () => {
      finish(audio.currentTime || 0);
    };

    audio.addEventListener("loadedmetadata", onMeta);
    audio.addEventListener("durationchange", onMeta);
    audio.addEventListener("seeked", onSeeked, { once: true });

    if (audio.readyState >= 1) onMeta();
    if (!settled) {
      try {
        audio.currentTime = 1e10;
      } catch {
        finish(0);
      }
    }

    window.setTimeout(() => finish(readDuration(audio)), 2500);
  });
}

export default function VoiceMessageBubble({ url, isMe, durationSeconds = 0 }) {
  const audioRef = useRef(null);
  const [playing, setPlaying] = useState(false);
  const [duration, setDuration] = useState(durationSeconds > 0 ? durationSeconds : 0);
  const [current, setCurrent] = useState(0);
  const [resolving, setResolving] = useState(false);

  const syncDuration = useCallback(async () => {
    const audio = audioRef.current;
    if (!audio) return;

    setResolving(true);
    try {
      const resolved = await resolveAudioDuration(audio, durationSeconds);
      if (resolved > 0) setDuration(resolved);
    } finally {
      setResolving(false);
    }
  }, [durationSeconds]);

  useEffect(() => {
    setDuration(durationSeconds > 0 ? durationSeconds : 0);
    setCurrent(0);
    setPlaying(false);
  }, [url, durationSeconds]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return undefined;

    const onLoaded = () => {
      const value = readDuration(audio);
      if (value > 0) setDuration(value);
    };
    const onTimeUpdate = () => setCurrent(audio.currentTime || 0);
    const onEnded = () => {
      setPlaying(false);
      setCurrent(0);
      const value = readDuration(audio);
      if (value > 0) setDuration(value);
    };

    audio.addEventListener("loadedmetadata", onLoaded);
    audio.addEventListener("durationchange", onLoaded);
    audio.addEventListener("timeupdate", onTimeUpdate);
    audio.addEventListener("ended", onEnded);

    if (durationSeconds <= 0) {
      syncDuration();
    }

    return () => {
      audio.removeEventListener("loadedmetadata", onLoaded);
      audio.removeEventListener("durationchange", onLoaded);
      audio.removeEventListener("timeupdate", onTimeUpdate);
      audio.removeEventListener("ended", onEnded);
    };
  }, [url, durationSeconds, syncDuration]);

  useEffect(() => {
    if (!playing) return undefined;

    let frame = 0;
    const tick = () => {
      const audio = audioRef.current;
      if (audio) {
        const time = audio.currentTime || 0;
        setCurrent(time);
        const value = readDuration(audio);
        if (value > 0) setDuration((prev) => (prev > 0 ? prev : value));
      }
      frame = window.requestAnimationFrame(tick);
    };

    frame = window.requestAnimationFrame(tick);
    return () => window.cancelAnimationFrame(frame);
  }, [playing]);

  const togglePlay = async () => {
    const audio = audioRef.current;
    if (!audio) return;

    if (playing) {
      audio.pause();
      setPlaying(false);
      return;
    }

    if (duration <= 0) {
      await syncDuration();
    }

    try {
      await audio.play();
      setPlaying(true);
    } catch {
      setPlaying(false);
    }
  };

  const effectiveDuration = duration > 0 ? duration : 0;
  const progress =
    effectiveDuration > 0 ? Math.min(100, (current / effectiveDuration) * 100) : playing ? 8 : 0;
  const remaining = effectiveDuration > 0 ? Math.max(0, effectiveDuration - current) : 0;
  const totalLabel = resolving && effectiveDuration <= 0 ? "..." : formatTime(effectiveDuration);

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
            className={`h-full rounded-full transition-[width] duration-75 ${
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

        <div
          className={`flex items-center justify-between mt-1.5 gap-2 tabular-nums ${
            isMe ? "text-blue-100" : "text-slate-400"
          }`}
        >
          {playing ? (
            <>
              <span className={`text-xs font-semibold ${isMe ? "text-white" : "text-[#93c5fd]"}`}>
                {formatTime(remaining)}
              </span>
              <span className="text-[10px] opacity-70">{totalLabel} total</span>
            </>
          ) : (
            <span className="text-[11px]">{totalLabel}</span>
          )}
        </div>
      </div>

      <audio ref={audioRef} src={url} preload="auto" className="hidden" />
    </div>
  );
}
