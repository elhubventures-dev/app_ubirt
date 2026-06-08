import { authenticateRequest } from "../payment/auth.js";
import { applyRateLimit, getClientIp } from "../rateLimit.js";

export async function handleAiChat(req, res) {
  const auth = await authenticateRequest(req);
  if (auth.error) {
    return res.status(auth.error.status).json({ error: auth.error.message });
  }

  const ip = getClientIp(req);
  if (!applyRateLimit(req, res, `ai-chat:${auth.user.id}:${ip}`, { limit: 20, windowMs: 60_000 })) {
    return;
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return res.status(503).json({
      error: "OPENAI_API_KEY is not configured on the server.",
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

  const prompt = body?.prompt?.trim();
  if (!prompt) {
    return res.status(400).json({ error: "prompt is required" });
  }

  try {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: process.env.OPENAI_MODEL || "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content:
              "You are UBIRT AI, a concise assistant for creators. Help with scripts, hooks, captions, and growth ideas.",
          },
          { role: "user", content: prompt },
        ],
        max_tokens: 600,
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      return res.status(502).json({ error: "OpenAI request failed", detail: errText });
    }

    const data = await response.json();
    const reply = data.choices?.[0]?.message?.content?.trim() ?? "No response generated.";
    return res.status(200).json({ reply });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
}
