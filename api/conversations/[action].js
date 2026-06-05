import { applyCors, handleCorsPreflight } from "../lib/cors.js";
import { handleGroupConversation } from "../lib/conversations/groupHandler.js";
import { handleStartConversation } from "../lib/conversations/startHandler.js";

export default async function handler(req, res) {
  if (handleCorsPreflight(req, res)) return;
  applyCors(req, res);

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const action = req.query.action;

  try {
    if (action === "start") {
      return await handleStartConversation(req, res);
    }
    if (action === "group") {
      return await handleGroupConversation(req, res);
    }
    return res.status(404).json({ error: "Unknown conversation action" });
  } catch (error) {
    console.error(`conversation/${action} error:`, error);
    return res.status(500).json({ error: error.message || "Conversation request failed" });
  }
}
