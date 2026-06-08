/** Lightweight client-side profanity check before UGC is saved. */
const BLOCKED = [
  "fuck",
  "shit",
  "bitch",
  "asshole",
  "bastard",
  "cunt",
  "dick",
  "pussy",
  "nigger",
  "nigga",
  "faggot",
  "retard",
  "whore",
  "slut",
];

function normalizeForScan(text) {
  return String(text || "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/(.)\1{2,}/g, "$1$1")
    .replace(/\s+/g, " ")
    .trim();
}

export function containsProfanity(text) {
  const normalized = normalizeForScan(text);
  if (!normalized) return false;
  const tokens = normalized.split(" ");
  return BLOCKED.some((word) => tokens.includes(word) || normalized.includes(` ${word} `) || normalized.startsWith(`${word} `) || normalized.endsWith(` ${word}`));
}

export async function moderateUserText(text, { useApi = true } = {}) {
  const input = String(text || "").trim();
  if (!input) return { allowed: true };

  if (containsProfanity(input)) {
    return {
      allowed: false,
      reason: "This content contains language that isn't allowed on UBIRT.",
    };
  }

  if (!useApi) return { allowed: true };

  try {
    const { getApiUrl } = await import("@/lib/apiBase");
    const res = await fetch(getApiUrl("/api/ai/moderate"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ input }),
    });
    if (!res.ok) return { allowed: true };
    const data = await res.json();
    if (data.flagged) {
      return {
        allowed: false,
        reason: "This content was flagged by our safety filters. Please revise and try again.",
      };
    }
  } catch {
    // Fail open when moderation API is unavailable.
  }

  return { allowed: true };
}

export async function assertCleanText(text, label = "Content") {
  const result = await moderateUserText(text);
  if (!result.allowed) {
    throw new Error(result.reason || `${label} is not allowed.`);
  }
}
