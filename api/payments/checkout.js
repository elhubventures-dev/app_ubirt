import crypto from "crypto";
import { applyCors, handleCorsPreflight } from "../lib/cors.js";
import { authenticateRequest, getAdminSupabase } from "../lib/payment/auth.js";
import {
  createFincraCheckout,
  formatFincraCustomerName,
  getFincraRedirectBase,
} from "../lib/payment/fincra.js";

const SUPPORTED_GATEWAYS = new Set(["fincra"]);

const FINCRA_PAYMENT_METHODS = {
  NGN: ["bank_transfer", "card", "payattitude"],
  GHS: ["bank_transfer", "mobile_money"],
  KES: ["bank_transfer", "mobile_money"],
  UGX: ["bank_transfer", "mobile_money"],
  ZAR: ["bank_transfer", "card"],
  ZMW: ["mobile_money", "card"],
  XAF: ["mobile_money"],
  XOF: ["mobile_money"],
};

export default async function handler(req, res) {
  if (handleCorsPreflight(req, res)) return;
  applyCors(req, res);

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const auth = await authenticateRequest(req);
  if (auth.error) {
    return res.status(auth.error.status).json({ error: auth.error.message });
  }

  const gateway = (process.env.PAYMENT_GATEWAY || "fincra").toLowerCase();
  if (!SUPPORTED_GATEWAYS.has(gateway)) {
    return res.status(400).json({ error: `Checkout API does not support gateway: ${gateway}` });
  }

  const { packId, coins, amount, currency = "NGN" } = req.body ?? {};
  if (!packId || !coins || !amount) {
    return res.status(400).json({ error: "packId, coins, and amount are required" });
  }

  const parsedCoins = parseInt(coins, 10);
  const parsedAmount = parseInt(amount, 10);
  if (!Number.isFinite(parsedCoins) || parsedCoins <= 0 || !Number.isFinite(parsedAmount) || parsedAmount <= 0) {
    return res.status(400).json({ error: "Invalid coins or amount" });
  }

  const reference = crypto.randomUUID();
  const redirectBase = getFincraRedirectBase();
  const redirectUrl = `${redirectBase}/wallet?payment=return&reference=${reference}`;

  try {
    const supabaseAdmin = getAdminSupabase();

    const { error: pendingErr } = await supabaseAdmin.from("transactions").insert({
      user_id: auth.user.id,
      reference,
      gateway,
      amount: parsedAmount * 100,
      status: "pending",
      coins_added: parsedCoins,
      email: auth.user.email ?? null,
    });

    if (pendingErr) {
      console.error("Pending transaction insert failed:", pendingErr);
      return res.status(500).json({ error: "Failed to start checkout" });
    }

    const checkout = await createFincraCheckout({
      amount: parsedAmount,
      currency,
      reference,
      redirectUrl,
      customer: {
        name: formatFincraCustomerName(auth.user),
        email: auth.user.email,
      },
      metadata: {
        userId: auth.user.id,
        coins: parsedCoins,
        packId,
        gateway,
      },
      paymentMethods: FINCRA_PAYMENT_METHODS[currency] ?? ["card", "bank_transfer"],
    });

    if (checkout.error) {
      await supabaseAdmin
        .from("transactions")
        .update({ status: "failed" })
        .eq("reference", reference);

      return res.status(502).json({ error: checkout.error, details: checkout.details });
    }

    return res.status(200).json({
      gateway,
      reference,
      checkoutUrl: checkout.link,
      payCode: checkout.payCode,
    });
  } catch (err) {
    console.error("Checkout error:", err);
    return res.status(500).json({ error: "Checkout failed" });
  }
}
