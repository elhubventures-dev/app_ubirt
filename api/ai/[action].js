import { handleAiChat } from "../lib/ai/chatHandler.js";
import { handleAiCaptions } from "../lib/ai/captionsHandler.js";
import { handleAiModerate } from "../lib/ai/moderateHandler.js";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const action = req.query.action;

  try {
    if (action === "chat") return await handleAiChat(req, res);
    if (action === "captions") return await handleAiCaptions(req, res);
    if (action === "moderate") return await handleAiModerate(req, res);
    return res.status(404).json({ error: "Unknown AI action" });
  } catch (error) {
    console.error(`ai/${action} error:`, error);
    return res.status(500).json({ error: error.message || "AI request failed" });
  }
}
