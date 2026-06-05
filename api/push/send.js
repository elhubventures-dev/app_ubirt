import { dispatchPushToUser } from "../lib/push/dispatchPush.js";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { userId, title, body, data, notificationId, type } = req.body ?? {};
  if (!userId || !title) {
    return res.status(400).json({ error: "userId and title are required." });
  }

  const result = await dispatchPushToUser({
    userId,
    title,
    body,
    type,
    notificationId,
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
