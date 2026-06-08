import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { useAuth } from "@/lib/AuthContext";
import { getSupabase, isSupabaseConfigured } from "@/lib/supabaseClient";
import { startCall, joinCall, endCall } from "@/lib/callsApi";
import { useDailyCall } from "@/hooks/useDailyCall";
import IncomingCallSheet from "@/components/calls/IncomingCallSheet";
import ActiveCallOverlay from "@/components/calls/ActiveCallOverlay";

const CallContext = createContext(null);

function mapSession(row, userId) {
  if (!row) return null;
  return {
    id: row.id,
    conversationId: row.conversation_id,
    callType: row.call_type,
    status: row.status,
    roomUrl: row.daily_room_url,
    roomName: row.daily_room_name,
    initiatedBy: row.initiated_by,
    calleeId: row.callee_id,
    isIncoming: row.callee_id === userId && row.status === "ringing",
    isOutgoing: row.initiated_by === userId,
  };
}

export function CallProvider({ children }) {
  const { user } = useAuth();
  const daily = useDailyCall();
  const [activeSession, setActiveSession] = useState(null);
  const [incomingSession, setIncomingSession] = useState(null);
  const [isBusy, setIsBusy] = useState(false);

  const clearSessions = useCallback(async () => {
    setActiveSession(null);
    setIncomingSession(null);
    await daily.destroy();
  }, [daily]);

  const handleSessionRow = useCallback(
    (row) => {
      if (!user?.id || !row) return;
      const session = mapSession(row, user.id);
      if (!session) return;

      if (session.status === "ringing" && session.calleeId === user.id) {
        setIncomingSession(session);
        return;
      }

      if (session.status === "ringing" && session.initiatedBy === user.id) {
        setActiveSession(session);
        return;
      }

      if (session.status === "active") {
        setIncomingSession(null);
        setActiveSession(session);
        return;
      }

      if (["ended", "declined", "missed", "cancelled"].includes(session.status)) {
        if (activeSession?.id === session.id || incomingSession?.id === session.id) {
          clearSessions();
        }
      }
    },
    [user?.id, activeSession?.id, incomingSession?.id, clearSessions]
  );

  useEffect(() => {
    if (!user?.id || !isSupabaseConfigured()) return undefined;

    const supabase = getSupabase();
    const channel = supabase
      .channel(`calls:${user.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "call_sessions" },
        (payload) => {
          const row = payload.new;
          if (!row) return;
          if (row.initiated_by !== user.id && row.callee_id !== user.id) return;
          handleSessionRow(row);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id, handleSessionRow]);

  const placeCall = useCallback(
    async (conversationId, callType = "audio") => {
      setIsBusy(true);
      try {
        const result = await startCall({ conversationId, callType });
        const session = {
          id: result.callId,
          conversationId: result.conversationId,
          callType: result.callType,
          status: result.status,
          roomUrl: result.roomUrl,
          roomName: result.roomName,
          initiatedBy: user.id,
          calleeId: null,
          isIncoming: false,
          isOutgoing: true,
        };
        setActiveSession(session);
        await daily.join({ roomUrl: result.roomUrl, token: result.token, startVideo: callType === "video" });
        return session;
      } finally {
        setIsBusy(false);
      }
    },
    [daily, user?.id]
  );

  const acceptIncoming = useCallback(async () => {
    if (!incomingSession) return;
    setIsBusy(true);
    try {
      const result = await joinCall({ callId: incomingSession.id });
      setIncomingSession(null);
      setActiveSession({
        ...incomingSession,
        status: "active",
        roomUrl: result.roomUrl,
      });
      await daily.join({
        roomUrl: result.roomUrl,
        token: result.token,
        startVideo: incomingSession.callType === "video",
      });
    } finally {
      setIsBusy(false);
    }
  }, [incomingSession, daily]);

  const declineIncoming = useCallback(async () => {
    if (!incomingSession) return;
    try {
      await endCall({ callId: incomingSession.id, status: "declined" });
    } finally {
      setIncomingSession(null);
    }
  }, [incomingSession]);

  const hangUp = useCallback(async () => {
    const session = activeSession || incomingSession;
    if (!session) return;
    try {
      await endCall({
        callId: session.id,
        status: session.status === "ringing" ? "cancelled" : "ended",
      });
    } finally {
      await clearSessions();
    }
  }, [activeSession, incomingSession, clearSessions]);

  const value = useMemo(
    () => ({
      placeCall,
      acceptIncoming,
      declineIncoming,
      hangUp,
      activeSession,
      incomingSession,
      isBusy,
      daily,
    }),
    [placeCall, acceptIncoming, declineIncoming, hangUp, activeSession, incomingSession, isBusy, daily]
  );

  return (
    <CallContext.Provider value={value}>
      {children}
      {incomingSession ? (
        <IncomingCallSheet
          session={incomingSession}
          onAccept={acceptIncoming}
          onDecline={declineIncoming}
          isBusy={isBusy}
        />
      ) : null}
      {activeSession && daily.isJoined ? (
        <ActiveCallOverlay session={activeSession} onHangUp={hangUp} daily={daily} />
      ) : null}
    </CallContext.Provider>
  );
}

export function useCall() {
  const ctx = useContext(CallContext);
  if (!ctx) {
    throw new Error("useCall must be used within CallProvider");
  }
  return ctx;
}

/** Safe hook for optional call UI (returns null actions when provider missing). */
export function useCallOptional() {
  return useContext(CallContext);
}
