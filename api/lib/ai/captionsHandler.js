export async function handleAiCaptions(req, res) {
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

  const topic = body?.topic?.trim() || "general video";

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
              `You are an AI that generates engaging 3-line captions for short-form video (TikTok/Reels format).
               Output EXACTLY valid JSON in this format:
               [
                 {"time": "0:00", "text": "First engaging hook"},
                 {"time": "0:03", "text": "Second interesting point"},
                 {"time": "0:06", "text": "Call to action"}
               ]
               Do not include markdown or backticks. Only the raw JSON array.`,
          },
          { role: "user", content: `Generate captions for a video about: ${topic}` },
        ],
        max_tokens: 300,
        temperature: 0.7,
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      return res.status(502).json({ error: "OpenAI request failed", detail: errText });
    }

    const data = await response.json();
    const rawReply = data.choices?.[0]?.message?.content?.trim() || "[]";

    let captions = [];
    try {
      const cleaned = rawReply.replace(/```json/g, "").replace(/```/g, "").trim();
      captions = JSON.parse(cleaned);
    } catch {
      console.error("Failed to parse GPT JSON:", rawReply);
      captions = [
        { time: "0:00", text: "Welcome to this new video!" },
        { time: "0:03", text: "Today we are looking at something cool." },
        { time: "0:06", text: "Stay tuned for more." },
      ];
    }

    return res.status(200).json({ captions });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
}
