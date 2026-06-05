import { useState, useRef, useEffect, useMemo } from "react";
import { Link, useParams } from "react-router-dom";
import { useChatMessages, useConversation } from "@/hooks/useMessages";
import { formatPresenceStatus } from "@/lib/presence";
import { useToast } from "@/components/ui/use-toast";
import { motion, AnimatePresence } from "framer-motion";

const QUICK_EMOJIS = ["😀", "😂", "❤️", "🔥", "👍", "🎉", "😮", "🙏", "💯", "✨"];

export default function ChatDetail() {
  const { id } = useParams();
  const draftKey = `ubirt.draft.${id}`;
  const [text, setText] = useState(() => localStorage.getItem(draftKey) || "");
  const [showEmoji, setShowEmoji] = useState(false);
  const { data: conversation } = useConversation(id);
  const { data: messages = [], isLoading, sendMessage, isSending, isTyping, peerPresent, updateTyping } = useChatMessages(id);
  const { toast } = useToast();
  const presence = useMemo(
    () => formatPresenceStatus(conversation?.lastSeenAt, peerPresent),
    [conversation?.lastSeenAt, peerPresent]
  );
  const avatarSrc = conversation?.avatar || `https://api.dicebear.com/9.x/notionists/svg?seed=${conversation?.name || id}`;
  const profileLink = conversation?.username ? `/user/${conversation.username}` : null;
  const scrollRef = useRef(null);
  const typingTimeoutRef = useRef(null);

  const handleTyping = (val) => {
    setText(val);
    localStorage.setItem(draftKey, val);

    if (updateTyping) {
      updateTyping(true);
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = setTimeout(() => {
        updateTyping(false);
      }, 1500);
    }
  };

  const scrollToBottom = () => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isTyping]);

  const onSubmit = async (e) => {
    e.preventDefault();
    const val = text.trim();
    if (!val) return;
    try {
      setText("");
      localStorage.removeItem(draftKey);
      setShowEmoji(false);
      await sendMessage({ chatId: id, text: val });
      requestAnimationFrame(() => scrollToBottom());
    } catch (err) {
      toast({ title: "Failed to send", description: err.message, variant: "destructive" });
      setText(val);
    }
  };

  const appendEmoji = (emoji) => {
    handleTyping(text + emoji);
  };

  return (
    <div className="flex flex-col h-[100dvh] bg-[#0a0f16] text-white overflow-hidden relative">
      <header className="shrink-0 px-4 py-3 bg-[#101822]/80 backdrop-blur-xl border-b border-white/5 flex items-center justify-between z-10 shadow-sm relative">
        <Link to="/messages" className="text-[#3b82f6] flex items-center gap-1 -ml-2 p-2 hover:bg-white/5 rounded-full transition-colors">
          <span className="material-symbols-outlined text-[24px]">arrow_back_ios</span>
        </Link>

        {profileLink ? (
          <Link
            to={profileLink}
            className="flex flex-col items-center absolute left-1/2 -translate-x-1/2 hover:opacity-90 transition-opacity"
          >
            <div className="w-8 h-8 rounded-full bg-slate-800 overflow-hidden shadow-sm mb-1">
              <img src={avatarSrc} alt={conversation?.name || "User"} className="w-full h-full object-cover" />
            </div>
            <h1 className="text-xs font-semibold tracking-wide">{conversation?.name || "Chat"}</h1>
            <span className={`text-[9px] font-medium ${presence.isActive ? "text-emerald-400" : "text-slate-500"}`}>
              {presence.label}
            </span>
          </Link>
        ) : (
          <div className="flex flex-col items-center absolute left-1/2 -translate-x-1/2">
            <div className="w-8 h-8 rounded-full bg-slate-800 overflow-hidden shadow-sm mb-1">
              <img src={avatarSrc} alt={conversation?.name || "User"} className="w-full h-full object-cover" />
            </div>
            <h1 className="text-xs font-semibold tracking-wide">{conversation?.name || "Chat"}</h1>
            <span className={`text-[9px] font-medium ${presence.isActive ? "text-emerald-400" : "text-slate-500"}`}>
              {presence.label}
            </span>
          </div>
        )}

        <div className="w-10" />
      </header>

      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-6 flex flex-col gap-1 z-0 hide-scrollbar">
        {isLoading ? (
          <div className="flex items-center justify-center h-full">
            <div className="animate-spin-slow rounded-full h-8 w-8 border-t-2 border-b-2 border-[#3b82f6]" />
          </div>
        ) : (
          <AnimatePresence>
            {messages.map((message, i) => {
              const isMe = message.role === "me";
              const nextMsg = messages[i + 1];
              const isLastInGroup = !nextMsg || nextMsg.role !== message.role;
              const prevMsg = messages[i - 1];
              const isFirstInGroup = !prevMsg || prevMsg.role !== message.role;

              return (
                <motion.div
                  key={message.id}
                  initial={{ opacity: 0, y: 10, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  layout
                  className={`flex flex-col max-w-[75%] ${isMe ? "self-end items-end" : "self-start items-start"} ${!isLastInGroup ? "mb-0.5" : "mb-3"}`}
                >
                  <div
                    className={`px-4 py-2.5 text-[15px] leading-relaxed shadow-sm relative ${
                      isMe ? "bg-[#3b82f6] text-white" : "bg-[#202938] text-slate-100 border border-white/5"
                    } ${
                      isMe
                        ? `${isFirstInGroup ? "rounded-tl-2xl" : "rounded-tl-lg"} ${isFirstInGroup ? "rounded-tr-2xl" : "rounded-tr-lg"} ${isLastInGroup ? "rounded-br-sm" : "rounded-br-lg"} ${isLastInGroup ? "rounded-bl-2xl" : "rounded-bl-lg"}`
                        : `${isFirstInGroup ? "rounded-tr-2xl" : "rounded-tr-lg"} ${isFirstInGroup ? "rounded-tl-2xl" : "rounded-tl-lg"} ${isLastInGroup ? "rounded-bl-sm" : "rounded-bl-lg"} ${isLastInGroup ? "rounded-br-2xl" : "rounded-br-lg"}`
                    }`}
                  >
                    {message.text}
                  </div>
                  {isMe && isLastInGroup && message.status && (
                    <span className="text-[10px] text-slate-500 mt-1 mr-1 font-medium">{message.status}</span>
                  )}
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
              Typing...
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <footer className="shrink-0 px-4 pb-[calc(1rem+env(safe-area-inset-bottom))] pt-2 bg-[#0a0f16] border-t border-white/5 z-10">
        {showEmoji && (
          <div className="flex flex-wrap gap-2 bg-[#1a2332] border border-white/10 rounded-2xl p-3 mb-2">
            {QUICK_EMOJIS.map((emoji) => (
              <button
                key={emoji}
                type="button"
                onClick={() => appendEmoji(emoji)}
                className="text-xl hover:scale-110 transition-transform"
              >
                {emoji}
              </button>
            ))}
          </div>
        )}
        <form onSubmit={onSubmit} className="flex items-end gap-2 bg-[#1a2332] border border-white/10 rounded-3xl p-1.5 shadow-xl">
          <button
            type="button"
            onClick={() => setShowEmoji((v) => !v)}
            className="p-2.5 text-slate-400 hover:text-white transition-colors bg-[#253043] rounded-full shrink-0"
          >
            <span className="material-symbols-outlined text-[20px]">mood</span>
          </button>
          <textarea
            value={text}
            onChange={(e) => handleTyping(e.target.value)}
            placeholder="Message..."
            className="flex-1 bg-transparent border-none text-white text-[15px] px-2 py-3 max-h-24 min-h-[44px] resize-none focus:outline-none hide-scrollbar leading-tight"
            rows={1}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                onSubmit(e);
              }
            }}
          />
          <button
            type="submit"
            disabled={isSending || !text.trim()}
            className={`p-2.5 rounded-full shrink-0 flex items-center justify-center transition-all ${
              text.trim() ? "bg-[#3b82f6] text-white shadow-[0_0_10px_rgba(59,130,246,0.6)] hover:bg-[#2563eb]" : "bg-[#253043] text-slate-500"
            }`}
          >
            <span className="material-symbols-outlined text-[20px] ml-0.5">send</span>
          </button>
        </form>
      </footer>
    </div>
  );
}
