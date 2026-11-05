import { authenticateRequest as authenticateSupabaseRequest, getAdminSupabase } from "./helpers.js";
import { authenticateRequest as authenticatePlatformRequest } from "../payment/auth.js";
import { getNeonSql, isNeonConfigured } from "../neon.js";

function useNeonConversations() {
  return isNeonConfigured() && (process.env.VITE_DATA_BACKEND || "").toLowerCase() === "neon";
}

async function findExistingDirectConversationNeon(sql, userId, otherUserId) {
  const rows = await sql`
    select cm1.conversation_id
    from public.conversation_members cm1
    join public.conversation_members cm2 on cm1.conversation_id = cm2.conversation_id
    join public.conversations c on c.id = cm1.conversation_id
    where cm1.user_id = ${userId}
      and cm2.user_id = ${otherUserId}
      and c.type = 'direct'
      and (
        select count(*)::int
        from public.conversation_members cm3
        where cm3.conversation_id = cm1.conversation_id
      ) = 2
    limit 1
  `;
  return rows?.[0]?.conversation_id ?? null;
}

async function startNeonConversation(userId, targetUserId) {
  const sql = getNeonSql();

  let convId = await findExistingDirectConversationNeon(sql, userId, targetUserId);

  const profiles = await sql`
    select display_name, username, avatar_url
    from public.profiles
    where id = ${targetUserId}
    limit 1
  `;
  const profile = profiles?.[0];
  if (!profile) {
    const err = new Error("User not found");
    err.status = 404;
    throw err;
  }

  if (!convId) {
    const title = profile.display_name || profile.username || "Chat";
    const created = await sql`
      insert into public.conversations (title, type, created_by)
      values (${title}, 'direct', ${userId})
      returning id
    `;
    convId = created?.[0]?.id;
    if (!convId) throw new Error("Failed to create conversation");

    await sql`
      insert into public.conversation_members (conversation_id, user_id, role)
      values
        (${convId}, ${userId}, 'member'),
        (${convId}, ${targetUserId}, 'member')
    `;
  }

  return {
    id: convId,
    name: profile.display_name ?? profile.username ?? "Chat",
    avatar: profile.avatar_url ?? null,
  };
}

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

async function startSupabaseConversation(userId, targetUserId) {
  const admin = getAdminSupabase();
  let convId = await findExistingDirectConversation(admin, userId, targetUserId);

  if (!convId) {
    const { data: profile } = await admin
      .from("profiles")
      .select("display_name, username, avatar_url")
      .eq("id", targetUserId)
      .maybeSingle();

    if (!profile) {
      const err = new Error("User not found");
      err.status = 404;
      throw err;
    }

    const { data: conv, error: convError } = await admin
      .from("conversations")
      .insert({
        title: profile.display_name || profile.username || "Chat",
        type: "direct",
        created_by: userId,
      })
      .select("id")
      .single();
    if (convError) throw convError;

    convId = conv.id;

    const { error: memberError } = await admin.from("conversation_members").insert([
      { conversation_id: convId, user_id: userId, role: "member" },
      { conversation_id: convId, user_id: targetUserId, role: "member" },
    ]);
    if (memberError) throw memberError;

    return {
      id: convId,
      name: profile.display_name ?? profile.username ?? "Chat",
      avatar: profile.avatar_url ?? null,
    };
  }

  const { data: profile } = await admin
    .from("profiles")
    .select("display_name, username, avatar_url")
    .eq("id", targetUserId)
    .maybeSingle();

  return {
    id: convId,
    name: profile?.display_name ?? profile?.username ?? "Chat",
    avatar: profile?.avatar_url ?? null,
  };
}

export async function handleStartConversation(req, res) {
  const auth = useNeonConversations()
    ? await authenticatePlatformRequest(req)
    : await authenticateSupabaseRequest(req);

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

  try {
    const result = useNeonConversations()
      ? await startNeonConversation(user.id, targetUserId)
      : await startSupabaseConversation(user.id, targetUserId);
    return res.status(200).json(result);
  } catch (error) {
    const status = error?.status || 500;
    if (status === 404) {
      return res.status(404).json({ error: error.message || "User not found" });
    }
    throw error;
  }
}
