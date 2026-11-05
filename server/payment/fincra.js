const DEFAULT_BASE_URL = "https://api.fincra.com";

function cleanEnv(value, fallback = "") {
  return String(value || fallback)
    .split(/\s+#/)[0]
    .trim();
}

export function getFincraRedirectBase() {
  const configured = cleanEnv(
    process.env.FINCRA_REDIRECT_URL || process.env.VITE_APP_URL,
    "https://www.app.ubirtai.site"
  ).replace(/\/$/, "");

  // Fincra sandbox rejects localhost redirect URLs — use HTTPS production URL instead.
  if (/^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(configured)) {
    return cleanEnv(process.env.FINCRA_REDIRECT_URL, "https://www.app.ubirtai.site").replace(/\/$/, "");
  }

  return configured;
}

export function formatFincraCustomerName(user) {
  const raw =
    user?.user_metadata?.full_name ||
    user?.user_metadata?.name ||
    user?.email?.split("@")[0] ||
    "UBIRT User";
  const trimmed = String(raw).trim();
  if (!trimmed) return "UBIRT User";
  if (trimmed.includes(" ")) return trimmed;
  return `${trimmed} User`;
}

export function getFincraConfig() {
  const apiKey = process.env.FINCRA_API_KEY;
  const publicKey = process.env.FINCRA_PUBLIC_KEY;
  const businessId = process.env.FINCRA_BUSINESS_ID;
  const baseUrl = cleanEnv(process.env.FINCRA_API_BASE_URL, DEFAULT_BASE_URL);

  if (!apiKey || !publicKey) {
    return { error: "FINCRA_API_KEY and FINCRA_PUBLIC_KEY are required." };
  }

  return { apiKey, publicKey, businessId, baseUrl };
}

export async function createFincraCheckout({
  amount,
  currency,
  reference,
  redirectUrl,
  customer,
  metadata,
  paymentMethods,
}) {
  const config = getFincraConfig();
  if (config.error) return { error: config.error };

  const payload = {
    amount,
    currency,
    reference,
    redirectUrl,
    feeBearer: "business",
    customer: {
      name: customer.name,
      email: customer.email,
      ...(customer.phoneNumber ? { phoneNumber: customer.phoneNumber } : {}),
    },
    metadata,
    settlementDestination: "wallet",
  };

  if (paymentMethods?.length) {
    payload.paymentMethods = paymentMethods;
  }

  const res = await fetch(`${config.baseUrl}/checkout/payments`, {
    method: "POST",
    headers: {
      accept: "application/json",
      "Content-Type": "application/json",
      "api-key": config.apiKey,
      "x-pub-key": config.publicKey,
    },
    body: JSON.stringify(payload),
  });

  const json = await res.json().catch(() => ({}));
  if (!res.ok || !json.status) {
    return {
      error: json.message || json.error || "Failed to create Fincra checkout",
      details: json,
    };
  }

  return {
    link: json.data?.link,
    payCode: json.data?.payCode,
    reference: json.data?.reference || reference,
  };
}

export async function verifyFincraPayment(reference) {
  const config = getFincraConfig();
  if (config.error) return { error: config.error };

  const headers = {
    accept: "application/json",
    "api-key": config.apiKey,
  };
  if (config.businessId) {
    headers["x-business-id"] = config.businessId;
  }

  const res = await fetch(
    `${config.baseUrl}/checkout/payments/merchant-reference/${encodeURIComponent(reference)}`,
    { headers }
  );

  const json = await res.json().catch(() => ({}));
  if (!res.ok || !json.status) {
    return { error: json.message || "Failed to verify Fincra payment" };
  }

  return { data: json.data };
}
