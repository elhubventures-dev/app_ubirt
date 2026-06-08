import { useCallback, useEffect, useRef, useState } from "react";
import DailyIframe from "@daily-co/daily-js";

export function useDailyCall() {
  const callRef = useRef(null);
  const [callObject, setCallObject] = useState(null);
  const [participants, setParticipants] = useState({});
  const [localAudio, setLocalAudioState] = useState(true);
  const [localVideo, setLocalVideoState] = useState(false);
  const [isJoined, setIsJoined] = useState(false);

  const destroy = useCallback(async () => {
    const call = callRef.current;
    callRef.current = null;
    setCallObject(null);
    if (!call) return;
    try {
      await call.leave();
    } catch {
      // ignore
    }
    try {
      call.destroy();
    } catch {
      // ignore
    }
    setIsJoined(false);
    setParticipants({});
  }, []);

  const join = useCallback(
    async ({ roomUrl, token, startVideo = false }) => {
      await destroy();
      const call = DailyIframe.createCallObject({
        subscribeToTracksAutomatically: true,
      });
      callRef.current = call;
      setCallObject(call);

      call.on("joined-meeting", () => setIsJoined(true));
      call.on("left-meeting", () => setIsJoined(false));
      call.on("participant-updated", () => {
        setParticipants({ ...call.participants() });
      });
      call.on("participant-joined", () => {
        setParticipants({ ...call.participants() });
      });
      call.on("participant-left", () => {
        setParticipants({ ...call.participants() });
      });

      await call.join({ url: roomUrl, token });
      await call.setLocalAudio(true);
      await call.setLocalVideo(startVideo);
      setLocalAudioState(true);
      setLocalVideoState(startVideo);
      setParticipants({ ...call.participants() });
    },
    [destroy]
  );

  const setLocalAudio = useCallback(async (enabled) => {
    if (!callRef.current) return;
    await callRef.current.setLocalAudio(enabled);
    setLocalAudioState(enabled);
  }, []);

  const setLocalVideo = useCallback(async (enabled) => {
    if (!callRef.current) return;
    await callRef.current.setLocalVideo(enabled);
    setLocalVideoState(enabled);
  }, []);

  useEffect(() => () => {
    destroy();
  }, [destroy]);

  return {
    join,
    destroy,
    setLocalAudio,
    setLocalVideo,
    localAudio,
    localVideo,
    isJoined,
    participants,
    callObject,
  };
}
