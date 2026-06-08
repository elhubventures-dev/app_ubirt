const STATUS_LABELS = {
  sent: "Sent",
  delivered: "Delivered",
  seen: "Seen",
  read: "Seen",
};

export function formatMessageTime(iso) {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";

  const now = new Date();
  const isToday =
    date.getDate() === now.getDate() &&
    date.getMonth() === now.getMonth() &&
    date.getFullYear() === now.getFullYear();

  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  const isYesterday =
    date.getDate() === yesterday.getDate() &&
    date.getMonth() === yesterday.getMonth() &&
    date.getFullYear() === yesterday.getFullYear();

  const time = date.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
  if (isToday) return time;
  if (isYesterday) return `Yesterday ${time}`;
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

export function resolveOutgoingStatus(message, { peerLastReadAt, isGroup, memberReads = [] } = {}) {
  if (!message || message.role !== "me") return null;

  const createdAt = message.createdAt ? new Date(message.createdAt).getTime() : 0;
  const dbStatus = message.status ?? "sent";

  if (isGroup) {
    const seenCount = memberReads.filter((row) => {
      if (!row?.lastReadAt || !createdAt) return false;
      return new Date(row.lastReadAt).getTime() >= createdAt;
    }).length;

    if (seenCount > 0) {
      return { status: "seen", seenCount };
    }
    return { status: dbStatus === "sent" ? "delivered" : dbStatus === "read" ? "seen" : dbStatus };
  }

  if (peerLastReadAt && createdAt && new Date(peerLastReadAt).getTime() >= createdAt) {
    return { status: "seen" };
  }
  if (dbStatus === "read") return { status: "seen" };
  if (dbStatus === "delivered") return { status: "delivered" };
  return { status: "sent" };
}

export function getStatusLabel(status, seenCount) {
  if (status === "seen" && seenCount > 1) {
    return `Seen by ${seenCount}`;
  }
  return STATUS_LABELS[status] ?? status;
}

export function getStatusIcon(status) {
  if (status === "seen" || status === "read") return "done_all";
  if (status === "delivered") return "done_all";
  return "check";
}
