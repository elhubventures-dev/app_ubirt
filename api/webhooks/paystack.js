import crypto from "crypto";
import { createClient } from "@supabase/supabase-js";
import { creditCoinPurchase } from "../lib/payment/creditPurchase.js";

/**
 * Vercel serverless: Paystack Webhook Listener
 * POST /api/webhooks/paystack
 */
export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const secret = process.env.PAYSTACK_SECRET_KEY;
  if (!secret) {
    return res.status(503).json({ error: "PAYSTACK_SECRET_KEY is missing." });
  }

  // Validate Paystack signature
  const hash = crypto
    .createHmac("sha512", secret)
    .update(JSON.stringify(req.body))
    .digest("hex");

  if (hash !== req.headers["x-paystack-signature"]) {
    return res.status(401).json({ error: "Invalid signature" });
  }

  const event = req.body;

  // We only care about successful charges
  if (event.event === "charge.success") {
    const data = event.data;
    const { reference, amount, metadata, customer } = data;
    
    // metadata should contain the user_id and coins to add
    const userId = metadata?.userId;
    const coinsToAdd = metadata?.coins;

    if (!userId || !coinsToAdd) {
      return res.status(400).json({ error: "Missing metadata (userId, coins)" });
    }

    const supabaseUrl = process.env.VITE_SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    
    if (!supabaseUrl || !supabaseServiceKey) {
      console.error("Missing Supabase admin keys for webhook.");
      return res.status(500).json({ error: "Server misconfiguration" });
    }

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    try {
      const result = await creditCoinPurchase(supabaseAdmin, {
        reference,
        gateway: "paystack",
        userId,
        coinsToAdd,
        amount,
        email: customer?.email,
      });

      return res.status(200).json(result);
    } catch (err) {
      console.error("Webhook processing error:", err);
      return res.status(500).json({ error: "Database update failed" });
    }
  }

  // Acknowledge other events without processing
  res.status(200).json({ status: "ignored" });
}
