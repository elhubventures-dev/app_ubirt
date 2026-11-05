import Ably from "ably";
import { getApiUrl } from "@/lib/apiBase";
import { getAccessToken } from "@/lib/authToken";
import { getRealtimeProvider } from "@/lib/platformConfig";

let clientPromise = null;

export function isAblyRealtime() {
  return getRealtimeProvider() === "ably";
}

export async function getAblyClient() {
  if (!isAblyRealtime()) {
    throw new Error("Ably realtime is not enabled (set VITE_REALTIME_PROVIDER=ably).");
  }
  if (!clientPromise) {
    clientPromise = (async () => {
      const client = new Ably.Realtime({
        authCallback: async (tokenParams, callback) => {
          try {
            const access = await getAccessToken();
            if (!access) {
              callback(new Error("Not authenticated"), null);
              return;
            }
            const res = await fetch(getApiUrl("/api/ably/token"), {
              headers: { Authorization: `Bearer ${access}` },
            });
            const body = await res.json();
            if (!res.ok) {
              callback(new Error(body.error || "Ably token failed"), null);
              return;
            }
            callback(null, body);
          } catch (error) {
            callback(error, null);
          }
        },
      });
      return client;
    })();
  }
  return clientPromise;
}

export async function closeAblyClient() {
  if (!clientPromise) return;
  try {
    const client = await clientPromise;
    client.close();
  } catch {
    // ignore
  }
  clientPromise = null;
}

/**
 * Subscribe to notification inserts for the current user (Ably channel).
 * Server/API should publish to `notifications:{userId}` when creating notifications.
 */
export async function subscribeAblyNotifications(userId, onEvent) {
  const client = await getAblyClient();
  const channel = client.channels.get(`notifications:${userId}`);
  const listener = (message) => {
    onEvent(message?.data ?? message);
  };
  channel.subscribe("notification", listener);
  return () => {
    channel.unsubscribe("notification", listener);
  };
}

export async function subscribeAblyChat(chatId, handlers = {}) {
  const client = await getAblyClient();
  const channel = client.channels.get(`chat:${chatId}`);

  const onMessage = (message) => handlers.onMessage?.(message.data);
  const onDelete = (message) => handlers.onDelete?.(message.data);
  const onReaction = (message) => handlers.onReaction?.(message.data);
  const onReceipt = (message) => handlers.onReceipt?.(message.data);

  if (handlers.onMessage) channel.subscribe("message", onMessage);
  if (handlers.onDelete) channel.subscribe("message_delete", onDelete);
  if (handlers.onReaction) channel.subscribe("reaction", onReaction);
  if (handlers.onReceipt) channel.subscribe("read_receipt", onReceipt);

  let presenceUnsub = null;
  if (handlers.onPresence) {
    const onPresence = () => {
      channel.presence.get((err, members) => {
        if (err) return;
        const state = {};
        for (const m of members || []) {
          state[m.clientId] = [m.data || { userId: m.clientId }];
        }
        handlers.onPresence(state);
      });
    };
    channel.presence.subscribe(onPresence);
    channel.presence.enter({ chatId });
    presenceUnsub = () => {
      channel.presence.unsubscribe(onPresence);
      channel.presence.leave();
    };
  }

  return () => {
    if (handlers.onMessage) channel.unsubscribe("message", onMessage);
    if (handlers.onDelete) channel.unsubscribe("message_delete", onDelete);
    if (handlers.onReaction) channel.unsubscribe("reaction", onReaction);
    if (handlers.onReceipt) channel.unsubscribe("read_receipt", onReceipt);
    presenceUnsub?.();
  };
}
