import { useEffect, useRef } from "react";

export default function ActiveCallOverlay({ session, onHangUp, daily }) {
  const remoteAudioRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const isVideo = session.callType === "video";

  useEffect(() => {
    const call = daily.callObject;
    if (!call) return undefined;

    const attachTracks = () => {
      const participants = call.participants();
      const remote = Object.values(participants).find((p) => !p.local);
      if (!remote) return;

      const audioTrack = remote.tracks?.audio?.persistentTrack || remote.tracks?.audio?.track;
      if (audioTrack && remoteAudioRef.current) {
        remoteAudioRef.current.srcObject = new MediaStream([audioTrack]);
        remoteAudioRef.current.play().catch(() => {});
      }

      const videoTrack = remote.tracks?.video?.persistentTrack || remote.tracks?.video?.track;
      if (videoTrack && remoteVideoRef.current) {
        remoteVideoRef.current.srcObject = new MediaStream([videoTrack]);
        remoteVideoRef.current.play().catch(() => {});
      }
    };

    attachTracks();
    call.on("track-started", attachTracks);
    call.on("participant-updated", attachTracks);

    return () => {
      call.off("track-started", attachTracks);
      call.off("participant-updated", attachTracks);
    };
  }, [daily.callObject, daily.isJoined]);

  return (
    <div className="fixed inset-0 z-[500] bg-[#0a0f16] flex flex-col">
      <div className="flex-1 relative flex items-center justify-center p-6 pt-[calc(env(safe-area-inset-top)+1rem)]">
        {isVideo ? (
          <video
            ref={remoteVideoRef}
            autoPlay
            playsInline
            className="w-full max-w-lg aspect-[3/4] rounded-3xl bg-black object-cover"
          />
        ) : (
          <div className="text-center">
            <div className="w-28 h-28 rounded-full bg-[#3b82f6]/20 flex items-center justify-center mx-auto mb-4">
              <span className="material-symbols-outlined text-[56px] text-[#3b82f6]">call</span>
            </div>
            <p className="text-lg font-semibold text-white">
              {session.isOutgoing ? "Calling..." : "Connected"}
            </p>
            <p className="text-sm text-slate-400 mt-1 capitalize">{session.callType} call</p>
          </div>
        )}
        <audio ref={remoteAudioRef} autoPlay playsInline className="hidden" />
      </div>

      <div className="shrink-0 px-8 pb-[calc(env(safe-area-inset-bottom)+2rem)] flex items-center justify-center gap-6">
        <button
          type="button"
          onClick={() => daily.setLocalAudio(!daily.localAudio)}
          className={`w-14 h-14 rounded-full flex items-center justify-center ${
            daily.localAudio ? "bg-white/10 text-white" : "bg-red-500/30 text-red-300"
          }`}
          aria-label={daily.localAudio ? "Mute microphone" : "Unmute microphone"}
        >
          <span className="material-symbols-outlined">{daily.localAudio ? "mic" : "mic_off"}</span>
        </button>

        {isVideo ? (
          <button
            type="button"
            onClick={() => daily.setLocalVideo(!daily.localVideo)}
            className={`w-14 h-14 rounded-full flex items-center justify-center ${
              daily.localVideo ? "bg-white/10 text-white" : "bg-red-500/30 text-red-300"
            }`}
            aria-label={daily.localVideo ? "Turn camera off" : "Turn camera on"}
          >
            <span className="material-symbols-outlined">{daily.localVideo ? "videocam" : "videocam_off"}</span>
          </button>
        ) : null}

        <button
          type="button"
          onClick={onHangUp}
          className="w-16 h-16 rounded-full bg-red-500 text-white flex items-center justify-center shadow-lg shadow-red-500/30"
          aria-label="End call"
        >
          <span className="material-symbols-outlined text-[28px]">call_end</span>
        </button>
      </div>
    </div>
  );
}
