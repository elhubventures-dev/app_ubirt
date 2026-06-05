import { createClient } from "@supabase/supabase-js";
import { dispatchPushToUser } from "../lib/push/dispatchPush.js";

function getSupabaseAdmin() {
  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceKey) return null;
  return createClient(supabaseUrl, serviceKey);
}

function parseWebhookBody(req) {
  if (!req.body) return null;
  if (typeof req.body === "string") {
    try {
      return JSON.parse(req.body);
    } catch {
      return null;
    }
  }
  return req.body;
}

function verifyWebhookSecret(req) {
  const secret = process.env.NOTIFICATION_PUSH_WEBHOOK_SECRET;
  if (!secret) return true;
  const auth = req.headers.authorization || "";
  // pg_net trigger calls do not send Authorization; allow when header is absent.
  if (!auth) return true;
  return auth === `Bearer ${secret}`;
}

function pushTitleForType(type) {
  if (type === "message") return "New message";
  if (type === "gift") return "Gift received!";
  if (type === "follow") return "New follower";
  return "UBIRT";
}

/**
 * Supabase Database Webhook or pg_net trigger:
 * POST /api/webhooks/notification-push
 */
export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  if (!verifyWebhookSecret(req)) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const supabase = getSupabaseAdmin();
  if (!supabase) {
    return res.status(503).json({ error: "Supabase admin client unavailable." });
  }

  const payload = parseWebhookBody(req);
  const record = payload?.record ?? payload;
  if (!record?.id || !record?.user_id) {
    return res.status(400).json({ error: "record.id and record.user_id are required." });
  }

  const { data: notification, error } = await supabase
    .from("notifications")
    .select("id, user_id, type, text, conversation_id")
    .eq("id", record.id)
    .eq("user_id", record.user_id)
    .maybeSingle();

  if (error) {
    return res.status(500).json({ error: error.message });
  }
  if (!notification) {
    return res.status(404).json({ error: "Notification not found." });
  }

  let chatUrl = "/notifications";
  if (notification.conversation_id) {
    const { data: conv } = await supabase
      .from("conversations")
      .select("type")
      .eq("id", notification.conversation_id)
      .maybeSingle();
    chatUrl =
      conv?.type === "group"
        ? `/group/${notification.conversation_id}`
        : `/chat/${notification.conversation_id}`;
  }

  const data = {
    type: notification.type,
    notificationId: notification.id,
    ...(notification.conversation_id
      ? { chatId: notification.conversation_id, url: chatUrl }
      : { url: "/notifications" }),
  };

  const result = await dispatchPushToUser({
    userId: notification.user_id,
    title: pushTitleForType(notification.type),
    body: notification.text,
    type: notification.type,
    notificationId: notification.id,
    data,
  });

  if (result.error && !result.reason) {
    return res.status(503).json({ error: result.error });
  }
  if (result.error) {
    return res.status(500).json({ error: result.error });
  }

  return res.status(200).json(result);
}
