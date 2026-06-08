import { handleStartCall } from "../lib/calls/startHandler.js";
import { handleJoinCall } from "../lib/calls/joinHandler.js";
import { handleEndCall } from "../lib/calls/endHandler.js";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const action = req.query.action;

  try {
    if (action === "start") return await handleStartCall(req, res);
    if (action === "join") return await handleJoinCall(req, res);
    if (action === "end") return await handleEndCall(req, res);
    return res.status(404).json({ error: "Unknown call action" });
  } catch (error) {
    console.error(`calls/${action} error:`, error);
    return res.status(500).json({ error: error.message || "Call request failed" });
  }
}
