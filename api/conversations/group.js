import { createClient } from "@supabase/supabase-js";
import { applyCors, handleCorsPreflight } from "../lib/cors.js";

function getAdminSupabase() {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    throw new Error("Supabase service role is not configured on the server.");
  }
  return createClient(url, serviceKey, { auth: { persistSession: false } });
}

function generateInviteCode() {
  return crypto.randomUUID().replace(/-/g, "").slice(0, 12);
}

export default async function handler(req, res) {
  if (handleCorsPreflight(req, res)) return;
  applyCors(req, res);

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

    const { action, title, memberIds = [], conversationId, userId, role, inviteCode } = req.body ?? {};
    const admin = getAdminSupabase();

    if (action === "create") {
      if (!title?.trim()) {
        return res.status(400).json({ error: "Group name is required" });
      }

      const invite = generateInviteCode();
      const { data: conv, error: convError } = await admin
        .from("conversations")
        .insert({
          title: title.trim(),
          type: "group",
          created_by: user.id,
          invite_code: invite,
        })
        .select("id, title, invite_code")
        .single();
      if (convError) throw convError;

      const memberRows = [{ conversation_id: conv.id, user_id: user.id, role: "owner" }];
      for (const memberId of memberIds) {
        if (memberId && memberId !== user.id) {
          memberRows.push({ conversation_id: conv.id, user_id: memberId, role: "member" });
        }
      }

      const { error: memberError } = await admin.from("conversation_members").insert(memberRows);
      if (memberError) throw memberError;

      return res.status(200).json({
        id: conv.id,
        name: conv.title,
        type: "group",
        inviteCode: conv.invite_code,
      });
    }

    if (action === "addMembers") {
      if (!conversationId || !Array.isArray(memberIds) || !memberIds.length) {
        return res.status(400).json({ error: "conversationId and memberIds are required" });
      }

      const { data: membership } = await admin
        .from("conversation_members")
        .select("role")
        .eq("conversation_id", conversationId)
        .eq("user_id", user.id)
        .maybeSingle();

      if (!membership || !["owner", "admin"].includes(membership.role)) {
        return res.status(403).json({ error: "Only group owners and admins can add members" });
      }

      const rows = memberIds
        .filter((id) => id && id !== user.id)
        .map((id) => ({ conversation_id: conversationId, user_id: id, role: "member" }));

      const { error } = await admin.from("conversation_members").upsert(rows, {
        onConflict: "conversation_id,user_id",
        ignoreDuplicates: true,
      });
      if (error) throw error;

      return res.status(200).json({ ok: true });
    }

    if (action === "join") {
      if (!inviteCode?.trim()) {
        return res.status(400).json({ error: "inviteCode is required" });
      }

      const { data: conv, error: convError } = await admin
        .from("conversations")
        .select("id, title")
        .eq("invite_code", inviteCode.trim())
        .eq("type", "group")
        .maybeSingle();
      if (convError) throw convError;
      if (!conv) {
        return res.status(404).json({ error: "Invalid or expired group invite link" });
      }

      const { error: joinError } = await admin.from("conversation_members").upsert(
        { conversation_id: conv.id, user_id: user.id, role: "member" },
        { onConflict: "conversation_id,user_id", ignoreDuplicates: true }
      );
      if (joinError) throw joinError;

      return res.status(200).json({ id: conv.id, name: conv.title, type: "group" });
    }

    if (action === "updateRole") {
      if (!conversationId || !userId || !role) {
        return res.status(400).json({ error: "conversationId, userId, and role are required" });
      }

      const { data: membership } = await admin
        .from("conversation_members")
        .select("role")
        .eq("conversation_id", conversationId)
        .eq("user_id", user.id)
        .maybeSingle();

      if (membership?.role !== "owner") {
        return res.status(403).json({ error: "Only the group owner can change member roles" });
      }

      if (!["admin", "member"].includes(role)) {
        return res.status(400).json({ error: "Invalid role" });
      }

      const { error } = await admin
        .from("conversation_members")
        .update({ role })
        .eq("conversation_id", conversationId)
        .eq("user_id", userId)
        .neq("role", "owner");
      if (error) throw error;

      return res.status(200).json({ ok: true });
    }

    if (action === "removeMember") {
      if (!conversationId || !userId) {
        return res.status(400).json({ error: "conversationId and userId are required" });
      }

      const { data: target } = await admin
        .from("conversation_members")
        .select("role")
        .eq("conversation_id", conversationId)
        .eq("user_id", userId)
        .maybeSingle();

      if (!target) {
        return res.status(404).json({ error: "Member not found" });
      }

      if (target.role === "owner" && userId !== user.id) {
        return res.status(403).json({ error: "Cannot remove the group owner" });
      }

      if (userId !== user.id) {
        const { data: caller } = await admin
          .from("conversation_members")
          .select("role")
          .eq("conversation_id", conversationId)
          .eq("user_id", user.id)
          .maybeSingle();
        if (!caller || !["owner", "admin"].includes(caller.role)) {
          return res.status(403).json({ error: "Only group owners and admins can remove members" });
        }
      } else if (target.role === "owner") {
        return res.status(403).json({ error: "Transfer ownership before leaving the group" });
      }

      const { error } = await admin
        .from("conversation_members")
        .delete()
        .eq("conversation_id", conversationId)
        .eq("user_id", userId);
      if (error) throw error;

      return res.status(200).json({ ok: true });
    }

    return res.status(400).json({ error: "Unknown action" });
  } catch (error) {
    console.error("group conversation error:", error);
    return res.status(500).json({ error: error.message || "Group operation failed" });
  }
}
