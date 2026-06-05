import { authenticateRequest, getAdminSupabase } from "./helpers.js";

async function findExistingDirectConversation(admin, userId, otherUserId) {
  const { data: myRows } = await admin
    .from("conversation_members")
    .select("conversation_id, conversations!inner(type)")
    .eq("user_id", userId);

  for (const row of myRows ?? []) {
    if (row.conversations?.type && row.conversations.type !== "direct") continue;

    const { data: members } = await admin
      .from("conversation_members")
      .select("user_id")
      .eq("conversation_id", row.conversation_id);

    const ids = (members ?? []).map((m) => m.user_id);
    if (ids.length === 2 && ids.includes(userId) && ids.includes(otherUserId)) {
      return row.conversation_id;
    }
  }
  return null;
}

export async function handleStartConversation(req, res) {
  const auth = await authenticateRequest(req);
  if (auth.error) {
    return res.status(auth.error.status).json({ error: auth.error.message });
  }
  const { user } = auth;

  const { targetUserId } = req.body ?? {};
  if (!targetUserId) {
    return res.status(400).json({ error: "targetUserId is required" });
  }
  if (targetUserId === user.id) {
    return res.status(400).json({ error: "You cannot message yourself." });
  }

  const admin = getAdminSupabase();
  let convId = await findExistingDirectConversation(admin, user.id, targetUserId);

  if (!convId) {
    const { data: profile } = await admin
      .from("profiles")
      .select("display_name, username, avatar_url")
      .eq("id", targetUserId)
      .maybeSingle();

    if (!profile) {
      return res.status(404).json({ error: "User not found" });
    }

    const { data: conv, error: convError } = await admin
      .from("conversations")
      .insert({
        title: profile.display_name || profile.username || "Chat",
        type: "direct",
        created_by: user.id,
      })
      .select("id")
      .single();
    if (convError) throw convError;

    convId = conv.id;

    const { error: memberError } = await admin.from("conversation_members").insert([
      { conversation_id: convId, user_id: user.id, role: "member" },
      { conversation_id: convId, user_id: targetUserId, role: "member" },
    ]);
    if (memberError) throw memberError;

    return res.status(200).json({
      id: convId,
      name: profile.display_name ?? profile.username ?? "Chat",
      avatar: profile.avatar_url ?? null,
    });
  }

  const { data: profile } = await admin
    .from("profiles")
    .select("display_name, username, avatar_url")
    .eq("id", targetUserId)
    .maybeSingle();

  return res.status(200).json({
    id: convId,
    name: profile?.display_name ?? profile?.username ?? "Chat",
    avatar: profile?.avatar_url ?? null,
  });
}
