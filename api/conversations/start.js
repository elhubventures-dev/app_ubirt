import { createClient } from "@supabase/supabase-js";

function getAdminSupabase() {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    throw new Error("Supabase service role is not configured on the server.");
  }
  return createClient(url, serviceKey, { auth: { persistSession: false } });
}

async function findExistingDirectConversation(admin, userId, otherUserId) {
  const { data: myRows } = await admin
    .from("conversation_members")
    .select("conversation_id")
    .eq("user_id", userId);

  for (const row of myRows ?? []) {
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

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const authHeader = req.headers.authorization || "";
    const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;
    if (!token) {
      return res.status(401).json({ error: "Missing auth token" });
    }

    const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
    const anonKey = process.env.VITE_SUPABASE_ANON_KEY;
    if (!url || !anonKey) {
      return res.status(500).json({ error: "Supabase is not configured" });
    }

    const userClient = createClient(url, anonKey, {
      global: { headers: { Authorization: `Bearer ${token}` } },
    });
    const {
      data: { user },
      error: authError,
    } = await userClient.auth.getUser();
    if (authError || !user) {
      return res.status(401).json({ error: "Unauthorized" });
    }

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
        .insert({ title: profile.display_name || profile.username || "Chat" })
        .select("id")
        .single();
      if (convError) throw convError;

      convId = conv.id;

      const { error: memberError } = await admin.from("conversation_members").insert([
        { conversation_id: convId, user_id: user.id },
        { conversation_id: convId, user_id: targetUserId },
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
  } catch (error) {
    console.error("start conversation error:", error);
    return res.status(500).json({ error: error.message || "Failed to start conversation" });
  }
}
