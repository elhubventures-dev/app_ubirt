import { useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import VoiceMessageBubble from "@/components/messages/VoiceMessageBubble";
import MessageMeta from "@/components/messages/MessageMeta";
import SharedPostBubble from "@/components/messages/SharedPostBubble";
import { REACTION_EMOJIS } from "@/lib/chatThemes";

function ReplyQuote({ replyTo, isMe }) {
  if (!replyTo) return null;
  return (
    <div
      className={`mb-2 pl-2 border-l-2 text-xs opacity-90 ${
        isMe ? "border-white/40 text-white/90" : "border-[#3b82f6]/60 text-slate-300"
      }`}
    >
      <p className="font-semibold truncate">{replyTo.senderName ?? "Message"}</p>
      <p className="truncate">
        {replyTo.mediaType === "audio" ? "Voice message" : replyTo.text || "Message"}
      </p>
    </div>
  );
}

function ReactionPills({ reactions, isMe, onToggle, messageId }) {
  if (!reactions?.length) return null;
  return (
    <div className={`flex flex-wrap gap-1 mt-1 ${isMe ? "justify-end" : "justify-start"}`}>
      {reactions.map((r) => (
        <button
          key={r.emoji}
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onToggle?.(messageId, r.emoji);
          }}
          className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[11px] border ${
            r.mine
              ? "bg-[#3b82f6]/20 border-[#3b82f6]/40 text-white"
              : "bg-[#1a2332] border-white/10 text-slate-200"
          }`}
        >
          <span>{r.emoji}</span>
          <span>{r.count}</span>
        </button>
      ))}
    </div>
  );
}

export default function ChatMessageList({
  messages,
  isLoading,
  scrollRef,
  conversation,
  theme,
  isGroup = false,
  menuMessageId,
  setMenuMessageId,
  onReply,
  onDelete,
  onToggleReaction,
  isDeleting,
  isTyping,
  typingLabel = "Typing...",
}) {
  useEffect(() => {
    if (!menuMessageId) return undefined;
    const closeMenu = () => setMenuMessageId(null);
    document.addEventListener("click", closeMenu);
    return () => document.removeEventListener("click", closeMenu);
  }, [menuMessageId, setMenuMessageId]);

  const meBubble = theme?.meBubble ?? "bg-[#3b82f6] text-white";
  const otherBubble = theme?.otherBubble ?? "bg-[#202938] text-slate-100 border border-white/5";
  const peerLastReadAt = conversation?.peerLastReadAt;
  const memberReads = conversation?.memberReads ?? [];
  const showReceipts = isGroup
    ? true
    : conversation?.peerShowReadReceipts !== false;

  return (
    <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 pt-3 pb-4 flex flex-col gap-1 z-0 hide-scrollbar">
      {isLoading ? (
        <div className="flex items-center justify-center h-full">
          <div className="animate-spin-slow rounded-full h-8 w-8 border-t-2 border-b-2 border-[#3b82f6]" />
        </div>
      ) : (
        <AnimatePresence>
          {messages.map((message, i) => {
            const isMe = message.role === "me";
            const nextMsg = messages[i + 1];
            const prevMsg = messages[i - 1];
            const sameSenderNext = nextMsg && nextMsg.senderId === message.senderId;
            const sameSenderPrev = prevMsg && prevMsg.senderId === message.senderId;
            const isLastInGroup = !sameSenderNext;
            const isFirstInGroup = !sameSenderPrev;
            const senderName = isMe ? "You" : message.senderName ?? "Member";
            const senderAvatar =
              message.senderAvatar ||
              `https://api.dicebear.com/9.x/notionists/svg?seed=${message.senderId || senderName}`;

            return (
              <motion.div
                key={message.id}
                initial={{ opacity: 0, y: 10, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                layout
                className={`flex max-w-[85%] ${isMe ? "self-end" : "self-start"} ${!isLastInGroup ? "mb-0.5" : "mb-3"}`}
              >
                {isGroup && !isMe && isFirstInGroup && (
                  <div className="w-8 h-8 rounded-full bg-slate-800 overflow-hidden mr-2 shrink-0 mt-1">
                    <img src={senderAvatar} alt="" className="w-full h-full object-cover" />
                  </div>
                )}
                {isGroup && !isMe && !isFirstInGroup && <div className="w-8 mr-2 shrink-0" />}

                <div
                  className={`relative flex flex-col ${isMe ? "items-end" : "items-start"} ${
                    !isGroup ? "max-w-full w-full" : ""
                  }`}
                >
                  {isGroup && !isMe && isFirstInGroup && (
                    <span className="text-[10px] text-slate-400 mb-1 ml-1 font-semibold">{senderName}</span>
                  )}

                  <div
                    role="button"
                    tabIndex={0}
                    onClick={(e) => {
                      e.stopPropagation();
                      setMenuMessageId((current) => (current === message.id ? null : message.id));
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        setMenuMessageId((current) => (current === message.id ? null : message.id));
                      }
                    }}
                    className={`px-4 py-2.5 text-[15px] leading-relaxed shadow-sm cursor-pointer ${isMe ? meBubble : otherBubble} ${
                      isMe
                        ? `${isFirstInGroup ? "rounded-tl-2xl" : "rounded-tl-lg"} ${isFirstInGroup ? "rounded-tr-2xl" : "rounded-tr-lg"} ${isLastInGroup ? "rounded-br-sm" : "rounded-br-lg"} ${isLastInGroup ? "rounded-bl-2xl" : "rounded-bl-lg"}`
                        : `${isFirstInGroup ? "rounded-tr-2xl" : "rounded-tr-lg"} ${isFirstInGroup ? "rounded-tl-2xl" : "rounded-tl-lg"} ${isLastInGroup ? "rounded-bl-sm" : "rounded-bl-lg"} ${isLastInGroup ? "rounded-br-2xl" : "rounded-br-lg"}`
                    }`}
                  >
                    <ReplyQuote replyTo={message.replyTo} isMe={isMe} />
                    {message.sharedPost ? (
                      <SharedPostBubble post={message.sharedPost} isMe={isMe} />
                    ) : message.mediaType === "audio" && message.mediaUrl ? (
                      <VoiceMessageBubble
                        url={message.mediaUrl}
                        isMe={isMe}
                        durationSeconds={message.mediaDuration ?? 0}
                      />
                    ) : message.text && message.text !== "Shared a post" ? (
                      message.text
                    ) : null}
                  </div>

                  <ReactionPills
                    reactions={message.reactions}
                    isMe={isMe}
                    messageId={message.id}
                    onToggle={onToggleReaction}
                  />

                  <AnimatePresence>
                    {menuMessageId === message.id && (
                      <motion.div
                        initial={{ opacity: 0, scale: 0.95, y: 4 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95, y: 4 }}
                        className={`absolute z-20 top-full mt-1 ${isMe ? "right-0" : "left-0"}`}
                        onClick={(e) => e.stopPropagation()}
                      >
                        <div className="flex flex-col gap-1 min-w-[200px]">
                          <div className="flex gap-1 px-2 py-2 rounded-xl bg-[#1a2332] border border-white/10 shadow-lg">
                            {REACTION_EMOJIS.map((emoji) => (
                              <button
                                key={emoji}
                                type="button"
                                onClick={() => {
                                  onToggleReaction?.(message.id, emoji);
                                  setMenuMessageId(null);
                                }}
                                className="text-lg hover:scale-110 transition-transform p-0.5"
                              >
                                {emoji}
                              </button>
                            ))}
                          </div>
                          <button
                            type="button"
                            onClick={() => {
                              onReply?.(message);
                              setMenuMessageId(null);
                            }}
                            className="flex items-center gap-2 px-3 py-2 rounded-xl bg-[#1a2332] border border-white/10 text-slate-200 text-xs font-semibold hover:bg-white/5 shadow-lg"
                          >
                            <span className="material-symbols-outlined text-[16px]">reply</span>
                            Reply
                          </button>
                          <button
                            type="button"
                            disabled={isDeleting}
                            onClick={() => onDelete?.(message.id, "me")}
                            className="flex items-center gap-2 px-3 py-2 rounded-xl bg-[#1a2332] border border-white/10 text-slate-200 text-xs font-semibold hover:bg-white/5 disabled:opacity-50 shadow-lg"
                          >
                            <span className="material-symbols-outlined text-[16px]">visibility_off</span>
                            Delete for me
                          </button>
                          {isMe && (
                            <button
                              type="button"
                              disabled={isDeleting}
                              onClick={() => onDelete?.(message.id, "everyone")}
                              className="flex items-center gap-2 px-3 py-2 rounded-xl bg-[#1a2332] border border-white/10 text-red-400 text-xs font-semibold hover:bg-red-500/10 disabled:opacity-50 shadow-lg"
                            >
                              <span className="material-symbols-outlined text-[16px]">delete</span>
                              Delete for everyone
                            </button>
                          )}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {isLastInGroup && (
                    <MessageMeta
                      message={message}
                      isMe={isMe}
                      showStatus={isMe && showReceipts}
                      peerLastReadAt={peerLastReadAt}
                      isGroup={isGroup}
                      memberReads={memberReads}
                    />
                  )}
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>
      )}

      <AnimatePresence>
        {isTyping && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            className="px-4 pb-2 text-[10px] text-slate-400 font-medium flex items-center gap-1"
          >
            <div className="flex gap-0.5">
              <span className="w-1 h-1 rounded-full bg-slate-400 animate-bounce" style={{ animationDelay: "0ms" }} />
              <span className="w-1 h-1 rounded-full bg-slate-400 animate-bounce" style={{ animationDelay: "150ms" }} />
              <span className="w-1 h-1 rounded-full bg-slate-400 animate-bounce" style={{ animationDelay: "300ms" }} />
            </div>
            {typingLabel}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
