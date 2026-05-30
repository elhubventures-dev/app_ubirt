/**
 * Vercel serverless: send email via Resend.
 * POST /api/email/send  { "to": "...", "subject": "...", "html": "..." }
 */
export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const apiKey = process.env.RESEND_API_KEY;
  const fromEmail = process.env.RESEND_FROM_EMAIL;
  const fromName = process.env.RESEND_FROM_NAME || "UBIRT";

  if (!apiKey || !fromEmail) {
    return res.status(503).json({
      error: "Resend is not configured. Set RESEND_API_KEY and RESEND_FROM_EMAIL.",
    });
  }

  let body = req.body;
  if (typeof body === "string") {
    try {
      body = JSON.parse(body);
    } catch {
      return res.status(400).json({ error: "Invalid JSON" });
    }
  }

  const { to, subject, html, text } = body ?? {};
  if (!to || !subject || (!html && !text)) {
    return res.status(400).json({ error: "to, subject, and html or text are required" });
  }

  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: `${fromName} <${fromEmail}>`,
        to: [to],
        subject,
        html: html ?? undefined,
        text: text ?? undefined,
      }),
    });

    const data = await response.json();
    if (!response.ok) {
      return res.status(response.status).json({ error: "Resend failed", detail: data });
    }
    return res.status(200).json({ id: data.id });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
}
