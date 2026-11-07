import { Webhook } from "svix";
import { syncClerkUserToNeon, isClerkConfigured } from "../clerkAuth.js";
import { isNeonConfigured } from "../neon.js";

export const config = {
  api: {
    bodyParser: false,
  },
};

async function readRawBody(req) {
  if (typeof req.body === "string") return req.body;
  if (Buffer.isBuffer(req.body)) return req.body.toString("utf8");
  if (req.body && typeof req.body === "object") return JSON.stringify(req.body);

  const chunks = [];
  for await (const chunk of req) {
    chunks.push(typeof chunk === "string" ? Buffer.from(chunk) : chunk);
  }
  return Buffer.concat(chunks).toString("utf8");
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  if (!isClerkConfigured()) {
    return res.status(503).json({ error: "Clerk is not configured" });
  }
  if (!isNeonConfigured()) {
    return res.status(503).json({ error: "Neon is not configured" });
  }

  const secret = process.env.CLERK_WEBHOOK_SECRET;
  if (!secret) {
    return res.status(503).json({ error: "CLERK_WEBHOOK_SECRET is not configured" });
  }

  try {
    const payload = await readRawBody(req);
    const wh = new Webhook(secret);
    const evt = wh.verify(payload, {
      "svix-id": req.headers["svix-id"],
      "svix-timestamp": req.headers["svix-timestamp"],
      "svix-signature": req.headers["svix-signature"],
    });

    const type = evt.type;
    const data = evt.data;

    if (type === "user.created" || type === "user.updated") {
      const email =
        data.email_addresses?.find((e) => e.id === data.primary_email_address_id)?.email_address ||
        data.email_addresses?.[0]?.email_address;
      const meta = data.unsafe_metadata || data.public_metadata || {};
      const username =
        data.username || meta.username || data.first_name || undefined;
      const displayName =
        meta.display_name ||
        [data.first_name, data.last_name].filter(Boolean).join(" ") ||
        username ||
        email;
      const avatarUrl = data.image_url || data.profile_image_url || null;

      await syncClerkUserToNeon({
        clerkId: data.id,
        email,
        username,
        displayName,
        avatarUrl,
        emailVerified: Boolean(
          data.email_addresses?.find((e) => e.id === data.primary_email_address_id)?.verification
            ?.status === "verified"
        ),
      });
    }

    return res.status(200).json({ ok: true });
  } catch (error) {
    console.error("Clerk webhook error:", error);
    return res.status(400).json({ error: error?.message || "Webhook verification failed" });
  }
}
