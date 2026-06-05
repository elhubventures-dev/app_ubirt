import { getApiUrl } from "@/lib/apiBase";

/** Best-effort native push fan-out via Vercel /api/push/send. */
export async function sendPushNotification({
  userId,
  title,
  body,
  type,
  notificationId,
  data,
}) {
  if (!userId || !title) return false;

  try {
    const res = await fetch(getApiUrl("/api/push/send"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        userId,
        title,
        body,
        type,
        notificationId,
        data,
      }),
    });
    if (!res.ok) {
      const json = await res.json().catch(() => ({}));
      console.warn("Push send failed:", json.error || json.reason || res.status);
      return false;
    }
    return true;
  } catch (error) {
    console.warn("Push send failed:", error);
    return false;
  }
}
