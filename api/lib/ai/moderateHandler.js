import { applyRateLimit, getClientIp } from "../rateLimit.js";

export async function handleAiModerate(req, res) {
  const ip = getClientIp(req);
  if (!applyRateLimit(req, res, `ai-moderate:${ip}`, { limit: 120, windowMs: 60_000 })) {
    return;
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return res.status(503).json({
      error: "OPENAI_API_KEY is not configured.",
      flagged: false,
    });
  }

  let body = req.body;
  if (typeof body === "string") {
    try {
      body = JSON.parse(body);
    } catch {
      return res.status(400).json({ error: "Invalid JSON body" });
    }
  }

  const input = body?.input?.trim();
  if (!input) {
    return res.status(400).json({ error: "input is required" });
  }

  try {
    const response = await fetch("https://api.openai.com/v1/moderations", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ input }),
    });

    if (!response.ok) {
      const errText = await response.text();
      return res.status(502).json({ error: "OpenAI request failed", detail: errText });
    }

    const data = await response.json();
    const flagged = data.results?.[0]?.flagged ?? false;

    return res.status(200).json({ flagged });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
}
