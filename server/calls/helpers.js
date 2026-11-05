import { getAdminSupabase } from "../payment/auth.js";
import { deleteDailyRoom } from "../daily.js";

const RING_STALE_MS = 45_000;
const ACTIVE_STALE_MS = 70 * 60 * 1000;

export async function expireStaleCalls(admin, conversationId) {
  const now = Date.now();
  const ringCutoff = new Date(now - RING_STALE_MS).toISOString();
  const activeCutoff = new Date(now - ACTIVE_STALE_MS).toISOString();

  const { data: openCalls, error } = await admin
    .from("call_sessions")
    .select("*")
    .eq("conversation_id", conversationId)
    .in("status", ["ringing", "active"]);
  if (error) throw error;

  for (const session of openCalls ?? []) {
    let finalStatus = null;
    if (session.status === "ringing" && session.created_at < ringCutoff) {
      finalStatus = "missed";
    } else if (session.status === "active") {
      const ref = session.started_at || session.created_at;
      if (ref < activeCutoff) finalStatus = "ended";
    }
    if (!finalStatus) continue;

    await admin
      .from("call_sessions")
      .update({ status: finalStatus, ended_at: new Date().toISOString() })
      .eq("id", session.id);
    await deleteDailyRoom(session.daily_room_name);
  }
}

/** Cancel a ringing call so the same caller can retry immediately. */
export async function cancelOutgoingRing(admin, session, userId) {
  if (session.status !== "ringing" || session.initiated_by !== userId) return false;

  await admin
    .from("call_sessions")
    .update({ status: "cancelled", ended_at: new Date().toISOString() })
    .eq("id", session.id);
  await deleteDailyRoom(session.daily_room_name);
  return true;
}

export async function getDirectConversationPeer(conversationId, userId) {
  const admin = getAdminSupabase();
  const { data: conv, error: convError } = await admin
    .from("conversations")
    .select("id, type")
    .eq("id", conversationId)
    .maybeSingle();
  if (convError) throw convError;
  if (!conv || conv.type !== "direct") {
    return { error: { status: 400, message: "Calls are only supported in direct messages." } };
  }

  const { data: members, error: memberError } = await admin
    .from("conversation_members")
    .select("user_id")
    .eq("conversation_id", conversationId);
  if (memberError) throw memberError;

  const memberIds = (members ?? []).map((m) => m.user_id);
  if (!memberIds.includes(userId)) {
    return { error: { status: 403, message: "You are not a member of this conversation." } };
  }

  const peerId = memberIds.find((id) => id !== userId);
  if (!peerId) {
    return { error: { status: 400, message: "Could not resolve call recipient." } };
  }

  return { peerId, conv };
}

export async function isBlockedBetween(userA, userB) {
  const admin = getAdminSupabase();
  const { data, error } = await admin
    .from("blocked_users")
    .select("blocker_id")
    .or(
      `and(blocker_id.eq.${userA},blocked_id.eq.${userB}),and(blocker_id.eq.${userB},blocked_id.eq.${userA})`
    )
    .limit(1);
  if (error) throw error;
  return (data ?? []).length > 0;
}

export async function getProfileDisplayName(userId) {
  const admin = getAdminSupabase();
  const { data } = await admin
    .from("profiles")
    .select("display_name, username")
    .eq("id", userId)
    .maybeSingle();
  return data?.display_name || data?.username || "UBIRT user";
}
