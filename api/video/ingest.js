/**
 * Vercel serverless: Mux ingest from a public media URL (server-side credentials).
 * POST /api/video/ingest  { "url": "https://..." }
 */
export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const tokenId = process.env.MUX_TOKEN_ID;
  const tokenSecret = process.env.MUX_TOKEN_SECRET;
  if (!tokenId || !tokenSecret) {
    return res.status(503).json({ error: "Mux is not configured", skipped: true });
  }

  let body = req.body;
  if (typeof body === "string") {
    try {
      body = JSON.parse(body);
    } catch {
      return res.status(400).json({ error: "Invalid JSON" });
    }
  }

  const url = body?.url;
  if (!url) return res.status(400).json({ error: "url is required" });

  try {
    const auth = Buffer.from(`${tokenId}:${tokenSecret}`).toString("base64");
    const response = await fetch("https://api.mux.com/video/v1/assets", {
      method: "POST",
      headers: {
        Authorization: `Basic ${auth}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        input: [{ url }],
        playback_policy: ["public"],
      }),
    });

    if (!response.ok) {
      const detail = await response.text();
      return res.status(502).json({ error: "Mux ingest failed", detail });
    }

    const json = await response.json();
    const playbackId = json.data?.playback_ids?.[0]?.id;
    return res.status(200).json({
      muxAssetId: json.data?.id,
      muxPlaybackId: playbackId,
      playbackUrl: playbackId ? `https://stream.mux.com/${playbackId}.m3u8` : null,
    });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
}
