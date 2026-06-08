import { authenticateRequest, getAdminSupabase } from "../lib/payment/auth.js";
import { deleteDailyRoom } from "../lib/daily.js";

const VALID_STATUS = new Set(["ended", "declined", "missed", "cancelled"]);

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const auth = await authenticateRequest(req);
  if (auth.error) {
    return res.status(auth.error.status).json({ error: auth.error.message });
  }

  const { callId, status = "ended" } = req.body ?? {};
  if (!callId) {
    return res.status(400).json({ error: "callId is required" });
  }
  if (!VALID_STATUS.has(status)) {
    return res.status(400).json({ error: "Invalid call status" });
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
      return res.status(403).json({ error: "Not allowed to end this call" });
    }

    let finalStatus = status;
    if (session.status === "ringing" && status === "ended") {
      finalStatus = session.initiated_by === auth.user.id ? "cancelled" : "declined";
    }

    const { data: updated, error: updateError } = await admin
      .from("call_sessions")
      .update({
        status: finalStatus,
        ended_at: new Date().toISOString(),
      })
      .eq("id", callId)
      .select("*")
      .single();
    if (updateError) throw updateError;

    await deleteDailyRoom(session.daily_room_name);

    return res.status(200).json({
      callId: updated.id,
      status: updated.status,
      conversationId: updated.conversation_id,
    });
  } catch (error) {
    console.error("Call end failed:", error);
    return res.status(500).json({ error: error.message || "Failed to end call" });
  }
}
