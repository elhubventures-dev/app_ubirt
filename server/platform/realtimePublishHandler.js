import { applyCors, handleCorsPreflight } from "../cors.js";
import { authenticateRequest } from "../payment/auth.js";
import { applyRateLimit, getClientIp } from "../rateLimit.js";
import { isAblyConfigured, publishChatEvent, publishUserNotification } from "../ablyPublish.js";

export default async function handler(req, res) {
  if (handleCorsPreflight(req, res)) return;
  applyCors(req, res);

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  if (!isAblyConfigured()) {
    return res.status(503).json({ error: "ABLY_API_KEY is not configured" });
  }

  const auth = await authenticateRequest(req);
  if (auth.error) {
    return res.status(auth.error.status).json({ error: auth.error.message });
  }

  const ip = getClientIp(req);
  if (!(await applyRateLimit(req, res, `ably-pub:${auth.user.id}:${ip}`, { limit: 120, windowMs: 60_000 }))) {
    return;
  }

  const { kind, userId, chatId, event, data } = req.body ?? {};

  try {
    if (kind === "notification") {
      if (!userId) return res.status(400).json({ error: "userId required" });
      await publishUserNotification(userId, data || {});
      return res.status(200).json({ ok: true });
    }
    if (kind === "chat") {
      if (!chatId || !event) return res.status(400).json({ error: "chatId and event required" });
      await publishChatEvent(chatId, event, data || {});
      return res.status(200).json({ ok: true });
    }
    return res.status(400).json({ error: "kind must be notification or chat" });
  } catch (error) {
    return res.status(500).json({ error: error?.message || "Publish failed" });
  }
}
