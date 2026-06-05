import crypto from "crypto";
import { createClient } from "@supabase/supabase-js";
import { creditCoinPurchase } from "../lib/payment/creditPurchase.js";

function getSupabaseAdmin() {
  const supabaseUrl = process.env.VITE_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !supabaseServiceKey) {
    return null;
  }
  return createClient(supabaseUrl, supabaseServiceKey);
}

function validateFincraSignature(req) {
  const secret = process.env.FINCRA_WEBHOOK_SECRET;
  if (!secret) {
    return { error: "FINCRA_WEBHOOK_SECRET is missing." };
  }

  const signature = req.headers.signature || req.headers["signature"];
  if (!signature) {
    return { valid: false };
  }

  const encryptedData = crypto
    .createHmac("sha512", secret)
    .update(JSON.stringify(req.body))
    .digest("hex");

  return { valid: encryptedData === signature };
}

/**
 * Vercel serverless: Fincra Webhook Listener
 * POST /api/webhooks/fincra
 */
export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const signatureCheck = validateFincraSignature(req);
  if (signatureCheck.error) {
    return res.status(503).json({ error: signatureCheck.error });
  }
  if (!signatureCheck.valid) {
    return res.status(401).json({ error: "Invalid signature" });
  }

  const event = req.body;
  if (event.event !== "charge.successful") {
    return res.status(200).json({ status: "ignored" });
  }

  const data = event.data ?? {};
  const reference = data.reference || data.merchantReference;
  if (!reference) {
    return res.status(400).json({ error: "Missing transaction reference" });
  }

  const supabaseAdmin = getSupabaseAdmin();
  if (!supabaseAdmin) {
    console.error("Missing Supabase admin keys for webhook.");
    return res.status(500).json({ error: "Server misconfiguration" });
  }

  try {
    const { data: pendingTx } = await supabaseAdmin
      .from("transactions")
      .select("user_id, coins_added, status")
      .eq("reference", reference)
      .eq("gateway", "fincra")
      .maybeSingle();

    const userId = pendingTx?.user_id || data.metadata?.userId;
    const coinsToAdd = pendingTx?.coins_added || data.metadata?.coins;

    if (!userId || !coinsToAdd) {
      return res.status(400).json({ error: "Missing userId or coins for transaction" });
    }

    const amount = Math.round((data.amountReceived ?? data.amount ?? 0) * 100);

    const result = await creditCoinPurchase(supabaseAdmin, {
      reference,
      gateway: "fincra",
      userId,
      coinsToAdd,
      amount,
      email: data.customer?.email,
    });

    return res.status(200).json(result);
  } catch (err) {
    console.error("Fincra webhook processing error:", err);
    return res.status(500).json({ error: "Database update failed" });
  }
}
