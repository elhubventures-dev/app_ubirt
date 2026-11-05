import Ably from "ably";

export function isAblyConfigured() {
  return Boolean(process.env.ABLY_API_KEY);
}

/**
 * Publish a notification event for realtime clients (Neon/Ably mode).
 */
export async function publishUserNotification(userId, payload) {
  if (!isAblyConfigured() || !userId) return;
  try {
    const rest = new Ably.Rest(process.env.ABLY_API_KEY);
    const channel = rest.channels.get(`notifications:${userId}`);
    await channel.publish("notification", payload);
  } catch (error) {
    console.warn("Ably publish notification failed:", error?.message || error);
  }
}

export async function publishChatEvent(chatId, eventName, payload) {
  if (!isAblyConfigured() || !chatId) return;
  try {
    const rest = new Ably.Rest(process.env.ABLY_API_KEY);
    const channel = rest.channels.get(`chat:${chatId}`);
    await channel.publish(eventName, payload);
  } catch (error) {
    console.warn("Ably publish chat failed:", error?.message || error);
  }
}
