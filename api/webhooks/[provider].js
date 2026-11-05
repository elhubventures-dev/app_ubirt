import handleFincra from "../lib/webhooks/fincraHandler.js";
import handlePaystack from "../lib/webhooks/paystackHandler.js";
import handleNotificationPush from "../lib/webhooks/notificationPushHandler.js";
import handleClerk from "../lib/webhooks/clerkHandler.js";

/**
 * Hobby-plan safe webhook router (counts as 1 serverless function).
 * Keeps existing URLs:
 *   POST /api/webhooks/fincra
 *   POST /api/webhooks/paystack
 *   POST /api/webhooks/notification-push
 *   POST /api/webhooks/clerk
 */
export default async function handler(req, res) {
  const provider = req.query.provider;

  try {
    if (provider === "fincra") return await handleFincra(req, res);
    if (provider === "paystack") return await handlePaystack(req, res);
    if (provider === "notification-push") return await handleNotificationPush(req, res);
    if (provider === "clerk") return await handleClerk(req, res);
    return res.status(404).json({ error: `Unknown webhook provider: ${provider}` });
  } catch (error) {
    console.error(`webhooks/${provider} error:`, error);
    return res.status(500).json({ error: error?.message || "Webhook failed" });
  }
}
