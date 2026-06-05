import { feedPostPath } from "@/lib/feedLinks";

export function getNotificationPath(item) {
  if (!item) return null;
  const type = String(item.type || "").toLowerCase();

  if (type === "message" && item.conversationId) {
    return `/chat/${item.conversationId}`;
  }
  if (type === "follow" && item.actorUsername) {
    return `/user/${item.actorUsername}`;
  }
  if (["like", "comment", "gift"].includes(type) && item.postId) {
    return feedPostPath(item.postId);
  }
  if (type === "message" && item.actorUsername) {
    return `/user/${item.actorUsername}`;
  }

  return null;
}
