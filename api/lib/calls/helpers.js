import { getAdminSupabase } from "../payment/auth.js";

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
