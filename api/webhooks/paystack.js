import crypto from "crypto";
import { createClient } from "@supabase/supabase-js";

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
      // 1. Check if transaction already exists (idempotency)
      const { data: existingTx } = await supabaseAdmin
        .from("transactions")
        .select("id")
        .eq("reference", reference)
        .single();
        
      if (existingTx) {
        return res.status(200).json({ status: "already_processed" });
      }

      // 2. Add transaction record
      await supabaseAdmin.from("transactions").insert({
        user_id: userId,
        reference: reference,
        amount: amount, // in kobo/pesewas etc.
        status: "success",
        coins_added: coinsToAdd,
        email: customer?.email
      });

      // 3. Credit coins atomically via RPC
      const { data: newBalance, error: coinsErr } = await supabaseAdmin.rpc("add_user_coins", {
        p_user_id: userId,
        p_amount: parseInt(coinsToAdd, 10),
      });

      if (coinsErr) throw coinsErr;

      return res.status(200).json({ status: "success", newBalance });
    } catch (err) {
      console.error("Webhook processing error:", err);
      return res.status(500).json({ error: "Database update failed" });
    }
  }

  // Acknowledge other events without processing
  res.status(200).json({ status: "ignored" });
}
