import Ably from "ably";
import { applyCors, handleCorsPreflight } from "../lib/cors.js";
import { authenticateRequest } from "../lib/payment/auth.js";
import { applyRateLimit, getClientIp } from "../lib/rateLimit.js";

export default async function handler(req, res) {
  if (handleCorsPreflight(req, res)) return;
  applyCors(req, res);

  if (req.method !== "GET" && req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const apiKey = process.env.ABLY_API_KEY;
  if (!apiKey) {
    return res.status(503).json({ error: "ABLY_API_KEY is not configured" });
  }

  const auth = await authenticateRequest(req);
  if (auth.error) {
    return res.status(auth.error.status).json({ error: auth.error.message });
  }

  const ip = getClientIp(req);
  if (!(await applyRateLimit(req, res, `ably-token:${auth.user.id}:${ip}`, { limit: 60, windowMs: 60_000 }))) {
    return;
  }

  try {
    const rest = new Ably.Rest(apiKey);
    const tokenRequest = await rest.auth.createTokenRequest({
      clientId: auth.user.id,
      capability: JSON.stringify({
        [`user:${auth.user.id}:*`]: ["subscribe", "publish", "presence"],
        [`chat:*`]: ["subscribe", "publish", "presence"],
        [`notifications:${auth.user.id}`]: ["subscribe"],
      }),
    });
    return res.status(200).json(tokenRequest);
  } catch (error) {
    console.error("Ably token error:", error);
    return res.status(500).json({ error: error?.message || "Failed to create Ably token" });
  }
}
