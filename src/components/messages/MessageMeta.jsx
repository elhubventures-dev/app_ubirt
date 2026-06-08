import { formatMessageTime, getStatusIcon, getStatusLabel, resolveOutgoingStatus } from "@/lib/messageStatus";

export default function MessageMeta({
  message,
  isMe,
  showStatus = false,
  peerLastReadAt,
  isGroup = false,
  memberReads = [],
}) {
  const time = formatMessageTime(message.createdAt);
  const delivery = showStatus
    ? resolveOutgoingStatus(message, { peerLastReadAt, isGroup, memberReads })
    : null;

  if (!time && !delivery) return null;

  const statusLabel = delivery ? getStatusLabel(delivery.status, delivery.seenCount) : null;
  const statusIcon = delivery ? getStatusIcon(delivery.status) : null;
  const isSeen = delivery?.status === "seen" || delivery?.status === "read";

  return (
    <div
      className={`flex items-center gap-1 mt-1 text-[10px] font-medium ${
        isMe ? "justify-end mr-1 text-slate-500" : "justify-start ml-1 text-slate-500"
      }`}
    >
      {time ? <span>{time}</span> : null}
      {statusLabel ? (
        <>
          {time ? <span className="opacity-50">·</span> : null}
          <span className={`inline-flex items-center gap-0.5 ${isSeen ? "text-[#60a5fa]" : ""}`}>
            {statusIcon ? (
              <span className={`material-symbols-outlined text-[12px] ${isSeen ? "text-[#60a5fa]" : "text-slate-500"}`}>
                {statusIcon}
              </span>
            ) : null}
            {statusLabel}
          </span>
        </>
      ) : null}
    </div>
  );
}
