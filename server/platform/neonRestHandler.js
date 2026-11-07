import { applyCors, handleCorsPreflight } from "../cors.js";
import { authenticateRequest } from "../payment/auth.js";
import { applyRateLimit, getClientIp } from "../rateLimit.js";
import { isNeonConfigured } from "../neon.js";
import { runNeonRest, runNeonRpc } from "../neonRest.js";

export default async function handler(req, res) {
  if (handleCorsPreflight(req, res)) return;
  applyCors(req, res);

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  if (!isNeonConfigured()) {
    return res.status(503).json({ error: "Neon DATABASE_URL is not configured" });
  }

  const auth = await authenticateRequest(req);
  if (auth.error) {
    return res.status(auth.error.status).json({ error: auth.error.message });
  }

  const ip = getClientIp(req);
  if (!(await applyRateLimit(req, res, `neon-rest:${auth.user.id}:${ip}`, { limit: 300, windowMs: 60_000 }))) {
    return;
  }

  try {
    const body = req.body ?? {};
    if (body.rpc) {
      const result = await runNeonRpc(body.rpc, body.args || {}, { userId: auth.user.id });
      return res.status(200).json(result);
    }
    const result = await runNeonRest(body);
    return res.status(200).json(result);
  } catch (error) {
    console.error("neon rest error:", error);
    return res.status(400).json({ data: null, error: { message: error?.message || "Query failed" } });
  }
}
