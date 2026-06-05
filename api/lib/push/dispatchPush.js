import { createClient } from "@supabase/supabase-js";
import crypto from "crypto";
import http2 from "http2";

export const PUSH_CHANNEL_ID = "ubirt_default";

function base64url(input) {
  return Buffer.from(input)
    .toString("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}

function cleanEnv(value) {
  return String(value || "")
    .trim()
    .replace(/^["']|["']$/g, "");
}

function formatPrivateKey(raw) {
  let key = cleanEnv(raw).replace(/\\n/g, "\n");
  if (!key) return "";

  if (!key.includes("BEGIN PRIVATE KEY")) {
    const bodyMatch = key.match(/(MII[A-Za-z0-9+/=\s\n]+-----END PRIVATE KEY-----)/);
    if (bodyMatch) {
      key = `-----BEGIN PRIVATE KEY-----\n${bodyMatch[1].trim()}`;
    }
  }

  return key;
}

function createSignedJwt({ header, payload, privateKey, algorithm }) {
  const encodedHeader = base64url(JSON.stringify(header));
  const encodedPayload = base64url(JSON.stringify(payload));
  const data = `${encodedHeader}.${encodedPayload}`;

  try {
    if (header.alg === "ES256") {
      const sign = crypto.createSign("SHA256");
      sign.update(data);
      sign.end();
      const signature = sign.sign({ key: privateKey, dsaEncoding: "ieee-p1363" });
      return `${data}.${base64url(signature)}`;
    }

    const signature = crypto.sign(algorithm, Buffer.from(data), privateKey);
    return `${data}.${base64url(signature)}`;
  } catch (error) {
    throw new Error(`Invalid private key for ${header.alg}: ${error.message}`);
  }
}

async function getFcmAccessToken() {
  const projectId = cleanEnv(process.env.FIREBASE_PROJECT_ID);
  const clientEmail = cleanEnv(process.env.FIREBASE_CLIENT_EMAIL);
  const privateKey = formatPrivateKey(process.env.FIREBASE_PRIVATE_KEY);
  if (!projectId || !clientEmail || !privateKey) {
    return { error: "FIREBASE_PROJECT_ID / FIREBASE_CLIENT_EMAIL / FIREBASE_PRIVATE_KEY are required for FCM v1." };
  }

  try {
    const now = Math.floor(Date.now() / 1000);
    const assertion = createSignedJwt({
      header: { alg: "RS256", typ: "JWT" },
      payload: {
        iss: clientEmail,
        sub: clientEmail,
        aud: "https://oauth2.googleapis.com/token",
        scope: "https://www.googleapis.com/auth/firebase.messaging",
        iat: now,
        exp: now + 3600,
      },
      privateKey,
      algorithm: "RSA-SHA256",
    });

    const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
        assertion,
      }),
    });
    const tokenJson = await tokenRes.json().catch(() => ({}));
    if (!tokenRes.ok || !tokenJson.access_token) {
      return { error: tokenJson.error_description || tokenJson.error || "Failed to fetch FCM access token." };
    }
    return { accessToken: tokenJson.access_token, projectId };
  } catch (error) {
    return { error: error.message || "FCM auth failed." };
  }
}

async function sendFcmV1({ accessToken, projectId, token, title, body, data }) {
  const response = await fetch(`https://fcm.googleapis.com/v1/projects/${projectId}/messages:send`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      message: {
        token,
        notification: { title, body: body || "" },
        data: Object.fromEntries(
          Object.entries(data || {}).map(([k, v]) => [k, typeof v === "string" ? v : JSON.stringify(v)])
        ),
        android: {
          priority: "high",
          collapse_key: data?.notificationId || data?.type || "ubirt",
          notification: {
            channel_id: PUSH_CHANNEL_ID,
            sound: "default",
            default_sound: true,
            notification_priority: "PRIORITY_HIGH",
            visibility: "PUBLIC",
            tag: data?.notificationId || undefined,
          },
        },
        apns: {
          headers: {
            "apns-priority": "10",
          },
          payload: {
            aps: {
              alert: { title, body: body || "" },
              sound: "default",
              badge: 1,
            },
          },
        },
      },
    }),
  });
  const json = await response.json().catch(() => ({}));
  return { ok: response.ok, provider: "fcm", token, response: json };
}

function createApnsJwt() {
  const teamId = cleanEnv(process.env.APNS_TEAM_ID);
  const keyId = cleanEnv(process.env.APNS_KEY_ID);
  const privateKey = formatPrivateKey(process.env.APNS_PRIVATE_KEY);
  if (!teamId || !keyId || !privateKey) {
    return { error: "APNS_TEAM_ID / APNS_KEY_ID / APNS_PRIVATE_KEY are required for APNs token auth." };
  }

  try {
    const now = Math.floor(Date.now() / 1000);
    const token = createSignedJwt({
      header: { alg: "ES256", kid: keyId },
      payload: { iss: teamId, iat: now },
      privateKey,
      algorithm: "ES256",
    });
    return { token };
  } catch (error) {
    return { error: error.message || "APNs auth failed." };
  }
}

async function sendApns({ token, title, body, data }) {
  const bundleId = process.env.APNS_BUNDLE_ID;
  if (!bundleId) {
    return { ok: false, provider: "apns", token, response: { error: "APNS_BUNDLE_ID missing." } };
  }
  const jwt = createApnsJwt();
  if (jwt.error) {
    return { ok: false, provider: "apns", token, response: { error: jwt.error } };
  }
  const host = process.env.APNS_USE_SANDBOX === "true" ? "api.sandbox.push.apple.com" : "api.push.apple.com";
  const payload = JSON.stringify({
    aps: {
      alert: { title, body: body || "" },
      sound: "default",
      badge: 1,
      "mutable-content": 1,
    },
    ...data,
  });

  return new Promise((resolve) => {
    const client = http2.connect(`https://${host}`);
    client.on("error", (error) => {
      resolve({ ok: false, provider: "apns", token, response: { error: error.message } });
    });
    const req = client.request({
      ":method": "POST",
      ":path": `/3/device/${token}`,
      "content-type": "application/json",
      authorization: `bearer ${jwt.token}`,
      "apns-topic": bundleId,
      "apns-push-type": "alert",
      "apns-priority": "10",
    });

    let responseBody = "";
    let status = 0;
    req.on("response", (headers) => {
      status = Number(headers[":status"] || 0);
    });
    req.on("data", (chunk) => {
      responseBody += chunk;
    });
    req.on("end", () => {
      client.close();
      let parsed = {};
      try {
        parsed = responseBody ? JSON.parse(responseBody) : {};
      } catch {
        parsed = { raw: responseBody };
      }
      resolve({ ok: status >= 200 && status < 300, provider: "apns", token, response: parsed, status });
    });
    req.on("error", (error) => {
      client.close();
      resolve({ ok: false, provider: "apns", token, response: { error: error.message } });
    });
    req.end(payload);
  });
}

async function loadUserTokens(supabase, userId) {
  const { data: rows, error } = await supabase
    .from("push_tokens")
    .select("token, provider, platform, enabled")
    .eq("user_id", userId)
    .eq("enabled", true);
  if (error) throw error;
  return rows ?? [];
}

function getSupabaseAdmin() {
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  if (!serviceKey || !supabaseUrl) {
    return null;
  }
  return createClient(supabaseUrl, serviceKey);
}

export function buildPushPayloadData({ type, notificationId, data }) {
  const payloadData = {
    ...(data || {}),
    type: type || "general",
    notificationId: notificationId ? String(notificationId) : undefined,
    url:
      data?.url ||
      (type === "message" && data?.chatId ? `/chat/${data.chatId}` : "/notifications"),
  };
  Object.keys(payloadData).forEach((k) => payloadData[k] == null && delete payloadData[k]);
  return payloadData;
}

export async function dispatchPushToUser({ userId, title, body, type, notificationId, data }) {
  const supabase = getSupabaseAdmin();
  if (!supabase) {
    return { sent: false, error: "Supabase admin client unavailable." };
  }

  let tokens = [];
  try {
    tokens = await loadUserTokens(supabase, userId);
  } catch (error) {
    return { sent: false, error: error.message };
  }

  if (!tokens.length) {
    return { sent: false, reason: "no_tokens" };
  }

  const payloadData = buildPushPayloadData({ type, notificationId, data });
  const fcmAuth = await getFcmAccessToken();
  if (!fcmAuth.accessToken && tokens.some((t) => t.provider === "fcm" || t.platform === "android")) {
    console.error("FCM auth failed:", fcmAuth.error);
  }
  const sendResults = await Promise.all(
    tokens.map(async ({ token, provider, platform }) => {
      if ((provider === "fcm" || platform === "android") && fcmAuth.accessToken) {
        return sendFcmV1({
          accessToken: fcmAuth.accessToken,
          projectId: fcmAuth.projectId,
          token,
          title,
          body,
          data: payloadData,
        });
      }
      if (provider === "apns" || platform === "ios") {
        return sendApns({ token, title, body, data: payloadData });
      }
      if (fcmAuth.accessToken) {
        return sendFcmV1({
          accessToken: fcmAuth.accessToken,
          projectId: fcmAuth.projectId,
          token,
          title,
          body,
          data: payloadData,
        });
      }
      return {
        ok: false,
        provider: provider || "unknown",
        token,
        response: {
          error: fcmAuth.error || "No provider credentials configured for token",
        },
      };
    })
  );

  return {
    sent: sendResults.some((r) => r.ok),
    total: sendResults.length,
    ok: sendResults.filter((r) => r.ok).length,
    failed: sendResults.filter((r) => !r.ok).length,
    providerAuth: {
      fcmConfigured: Boolean(fcmAuth.accessToken),
      fcmError: fcmAuth.error || undefined,
      apnsConfigured: Boolean(process.env.APNS_TEAM_ID && process.env.APNS_KEY_ID && process.env.APNS_PRIVATE_KEY),
    },
    results: sendResults,
  };
}
