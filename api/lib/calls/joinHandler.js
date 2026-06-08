import { authenticateRequest, getAdminSupabase } from "../payment/auth.js";
import { createDailyMeetingToken } from "../daily.js";
import { getProfileDisplayName } from "./helpers.js";

export async function handleJoinCall(req, res) {
  const auth = await authenticateRequest(req);
  if (auth.error) {
    return res.status(auth.error.status).json({ error: auth.error.message });
  }

  const { callId } = req.body ?? {};
  if (!callId) {
    return res.status(400).json({ error: "callId is required" });
  }

  try {
    const admin = getAdminSupabase();
    const { data: session, error } = await admin
      .from("call_sessions")
      .select("*")
      .eq("id", callId)
      .maybeSingle();
    if (error) throw error;
    if (!session) {
      return res.status(404).json({ error: "Call not found" });
    }

    const isParticipant =
      session.initiated_by === auth.user.id || session.callee_id === auth.user.id;
    if (!isParticipant) {
      return res.status(403).json({ error: "Not allowed to join this call" });
    }

    if (!["ringing", "active"].includes(session.status)) {
      return res.status(409).json({ error: `Call is ${session.status}` });
    }

    const userName = await getProfileDisplayName(auth.user.id);
    const token = await createDailyMeetingToken({
      roomName: session.daily_room_name,
      userName,
      isOwner: session.initiated_by === auth.user.id,
      callType: session.call_type,
    });

    if (session.status === "ringing") {
      await admin
        .from("call_sessions")
        .update({ status: "active", started_at: new Date().toISOString() })
        .eq("id", callId);
    }

    return res.status(200).json({
      callId: session.id,
      conversationId: session.conversation_id,
      callType: session.call_type,
      roomUrl: session.daily_room_url,
      roomName: session.daily_room_name,
      token,
      status: "active",
    });
  } catch (error) {
    console.error("Call join failed:", error);
    return res.status(500).json({ error: error.message || "Failed to join call" });
  }
}
