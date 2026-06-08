import { authenticateRequest, getAdminSupabase } from "../payment/auth.js";
import { applyRateLimit, getClientIp } from "../rateLimit.js";
import { createDailyMeetingToken, createDailyRoom } from "../daily.js";
import {
  getDirectConversationPeer,
  getProfileDisplayName,
  isBlockedBetween,
  expireStaleCalls,
  cancelOutgoingRing,
} from "./helpers.js";
import { dispatchPushToUser } from "../push/dispatchPush.js";

export async function handleStartCall(req, res) {
  const auth = await authenticateRequest(req);
  if (auth.error) {
    return res.status(auth.error.status).json({ error: auth.error.message });
  }

  const ip = getClientIp(req);
  if (!applyRateLimit(req, res, `call-start:${auth.user.id}:${ip}`, { limit: 15, windowMs: 60_000 })) {
    return;
  }

  const { conversationId, callType = "audio" } = req.body ?? {};
  if (!conversationId) {
    return res.status(400).json({ error: "conversationId is required" });
  }
  if (!["audio", "video"].includes(callType)) {
    return res.status(400).json({ error: "callType must be audio or video" });
  }

  try {
    const peerResult = await getDirectConversationPeer(conversationId, auth.user.id);
    if (peerResult.error) {
      return res.status(peerResult.error.status).json({ error: peerResult.error.message });
    }

    const { peerId } = peerResult;
    if (await isBlockedBetween(auth.user.id, peerId)) {
      return res.status(403).json({ error: "You cannot call this user." });
    }

    const admin = getAdminSupabase();

    await expireStaleCalls(admin, conversationId);

    const { data: activeCalls, error: activeError } = await admin
      .from("call_sessions")
      .select("*")
      .eq("conversation_id", conversationId)
      .in("status", ["ringing", "active"]);
    if (activeError) throw activeError;

    const activeCall = activeCalls?.[0] ?? null;
    if (activeCall) {
      const replaced = await cancelOutgoingRing(admin, activeCall, auth.user.id);
      if (!replaced) {
        return res.status(409).json({ error: "A call is already in progress for this chat." });
      }
    }

    const roomName = `ubirt-${conversationId.replace(/-/g, "").slice(0, 20)}-${Date.now()}`;
    const room = await createDailyRoom({ roomName, callType });
    const callerName = await getProfileDisplayName(auth.user.id);

    const { data: session, error: insertError } = await admin
      .from("call_sessions")
      .insert({
        conversation_id: conversationId,
        initiated_by: auth.user.id,
        callee_id: peerId,
        call_type: callType,
        status: "ringing",
        daily_room_name: room.name,
        daily_room_url: room.url,
      })
      .select("*")
      .single();
    if (insertError) throw insertError;

    const token = await createDailyMeetingToken({
      roomName: room.name,
      userName: callerName,
      isOwner: true,
      callType,
    });

    await dispatchPushToUser({
      userId: peerId,
      title: callType === "video" ? "Incoming video call" : "Incoming audio call",
      body: `${callerName} is calling you`,
      type: "message",
      data: {
        callId: session.id,
        conversationId,
        callType,
      },
    }).catch(() => {});

    return res.status(200).json({
      callId: session.id,
      conversationId,
      callType,
      roomUrl: room.url,
      roomName: room.name,
      token,
      status: session.status,
    });
  } catch (error) {
    console.error("Call start failed:", error);
    return res.status(500).json({ error: error.message || "Failed to start call" });
  }
}
