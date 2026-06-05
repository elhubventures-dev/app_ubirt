import { Browser } from "@capacitor/browser";
import { Capacitor } from "@capacitor/core";
import { getSupabase } from "@/lib/supabaseClient";
import { COIN_PACKAGES, PAYMENT_CURRENCY } from "@/lib/coinPackages";

export { PAYMENT_CURRENCY };
export const PAYMENT_GATEWAY = (import.meta.env.VITE_PAYMENT_GATEWAY || "fincra").toLowerCase();

export function getActiveGatewayLabel() {
  if (PAYMENT_GATEWAY === "fincra") return "Fincra";
  if (PAYMENT_GATEWAY === "paystack") return "Paystack";
  return PAYMENT_GATEWAY;
}

async function getAuthToken() {
  const supabase = getSupabase();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  return session?.access_token ?? null;
}

async function openCheckoutUrl(url) {
  if (Capacitor.isNativePlatform()) {
    await Browser.open({ url });
    return;
  }
  window.location.assign(url);
}

export async function startFincraCheckout(pack) {
  const token = await getAuthToken();
  if (!token) {
    throw new Error("You must be signed in to purchase coins.");
  }

  const res = await fetch("/api/payments/checkout", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      packId: pack.id,
      coins: pack.coins,
      amount: pack.amount,
      currency: PAYMENT_CURRENCY,
    }),
  });

  const raw = await res.text();
  let json = {};
  try {
    json = raw ? JSON.parse(raw) : {};
  } catch {
    throw new Error(
      res.ok
        ? "Invalid checkout response from server"
        : "Payment API unavailable. Run npm run dev:api locally or deploy to Vercel."
    );
  }

  if (!res.ok) {
    throw new Error(json.error || "Failed to start checkout");
  }

  if (!json.checkoutUrl) {
    throw new Error("Checkout URL was not returned");
  }

  await openCheckoutUrl(json.checkoutUrl);
}

export function getPaystackAmount(pack) {
  return pack.amount * 100;
}

export function findCoinPackage(packId) {
  return COIN_PACKAGES.find((pack) => pack.id === packId);
}
