const ACTIVE_THRESHOLD_MS = 30 * 60 * 1000;

function formatRelative(iso) {
  if (!iso) return "";
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export function formatPresenceStatus(lastSeenAt, peerOnlineAt) {
  const now = Date.now();

  if (peerOnlineAt) {
    const onlineMs = now - new Date(peerOnlineAt).getTime();
    if (onlineMs < ACTIVE_THRESHOLD_MS) {
      return { label: "Active now", isActive: true };
    }
  }

  if (lastSeenAt) {
    const diff = now - new Date(lastSeenAt).getTime();
    if (diff < ACTIVE_THRESHOLD_MS) {
      return { label: "Active now", isActive: true };
    }
    return { label: `Last seen ${formatRelative(lastSeenAt)}`, isActive: false };
  }

  return { label: "Offline", isActive: false };
}
