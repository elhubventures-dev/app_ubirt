export const DEFAULT_NOTIFICATION_PREFS = {
  inApp: true,
  likes: true,
  comments: true,
  messages: true,
  follows: true,
  gifts: true,
  mentions: true,
};

export function normalizeNotificationPrefs(raw) {
  const base = { ...DEFAULT_NOTIFICATION_PREFS };
  if (!raw || typeof raw !== "object") return base;
  for (const key of Object.keys(base)) {
    if (typeof raw[key] === "boolean") base[key] = raw[key];
  }
  return base;
}

/** Map notification row `type` to preference key. */
export function notificationTypeToPrefKey(type) {
  if (type === "message") return "messages";
  if (type === "like") return "likes";
  if (type === "comment") return "comments";
  if (type === "follow") return "follows";
  if (type === "gift") return "gifts";
  if (type === "mention" || type === "repost") return "mentions";
  return null;
}

export function shouldShowInAppNotification(prefs, type) {
  const normalized = normalizeNotificationPrefs(prefs);
  if (!normalized.inApp) return false;
  const key = notificationTypeToPrefKey(type);
  if (!key) return true;
  return normalized[key] !== false;
}
