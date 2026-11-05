import handleMe from "../lib/platform/meHandler.js";
import handleHealth from "../lib/platform/healthHandler.js";
import handleNeonRest from "../lib/platform/neonRestHandler.js";
import handleBlobUpload from "../lib/platform/blobUploadHandler.js";
import handleAblyToken from "../lib/platform/ablyTokenHandler.js";
import handleRealtimePublish from "../lib/platform/realtimePublishHandler.js";

/**
 * Hobby-plan safe router for resilience endpoints (counts as 1 serverless function).
 * Paths:
 *   GET  /api/platform/me
 *   GET  /api/platform/health
 *   POST /api/platform/neon-rest
 *   POST /api/platform/blob-upload
 *   GET|POST /api/platform/ably-token
 *   POST /api/platform/realtime-publish
 */
export default async function handler(req, res) {
  const action = req.query.action;

  try {
    if (action === "me") return await handleMe(req, res);
    if (action === "health") return await handleHealth(req, res);
    if (action === "neon-rest") return await handleNeonRest(req, res);
    if (action === "blob-upload") return await handleBlobUpload(req, res);
    if (action === "ably-token") return await handleAblyToken(req, res);
    if (action === "realtime-publish") return await handleRealtimePublish(req, res);
    return res.status(404).json({ error: `Unknown platform action: ${action}` });
  } catch (error) {
    console.error(`platform/${action} error:`, error);
    return res.status(500).json({ error: error?.message || "Platform request failed" });
  }
}
