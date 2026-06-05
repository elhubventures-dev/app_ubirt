import { useState, useRef, useEffect } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useChatMessages, useConversation } from "@/hooks/useMessages";
import { useVoiceRecorder } from "@/hooks/useVoiceRecorder";
import { useToast } from "@/components/ui/use-toast";
import { motion, AnimatePresence } from "framer-motion";
import GroupSettingsSheet from "@/components/messages/GroupSettingsSheet";
import VoiceMessageBubble from "@/components/messages/VoiceMessageBubble";
import { useQueryClient } from "@tanstack/react-query";

const QUICK_EMOJIS = ["😀", "😂", "❤️", "🔥", "👍", "🎉", "😮", "🙏", "💯", "✨"];

export default function CommunityChat() {
  const { id } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const draftKey = `ubirt.group.draft.${id}`;
  const [text, setText] = useState(() => localStorage.getItem(draftKey) || "");
  const [showEmoji, setShowEmoji] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [menuMessageId, setMenuMessageId] = useState(null);
  const { data: conversation, refetch: refetchConversation } = useConversation(id);
  const {
    data: messages = [],
    isLoading,
    sendMessage,
    isSending,
    deleteMessage,
    isDeleting,
    isTyping,
    typingUsers,
    onlineUsers,
    updateTyping,
  } = useChatMessages(id);
  const { toast } = useToast();
  const scrollRef = useRef(null);
  const typingTimeoutRef = useRef(null);
  const voiceStartRef = useRef(false);
  const voice = useVoiceRecorder();

  useEffect(() => {
    if (conversation && conversation.type === "direct") {
      navigate(`/chat/${id}`, { replace: true });
    }
  }, [conversation, id, navigate]);

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

  useEffect(() => {
    if (!menuMessageId) return undefined;
    const closeMenu = () => setMenuMessageId(null);
    document.addEventListener("click", closeMenu);
    return () => document.removeEventListener("click", closeMenu);
  }, [menuMessageId]);

  const handleDeleteMessage = async (messageId, scope) => {
    setMenuMessageId(null);
    try {
      await deleteMessage({ messageId, scope });
    } catch (err) {
      toast({ title: "Failed to delete", description: err.message, variant: "destructive" });
    }
  };

  const onSubmit = async (e) => {
    e.preventDefault();
    const val = text.trim();
    if (!val) return;
    try {
      setText("");
      localStorage.removeItem(draftKey);
      setShowEmoji(false);
      await sendMessage({ text: val });
      requestAnimationFrame(() => scrollToBottom());
    } catch (err) {
      toast({ title: "Failed to send", description: err.message, variant: "destructive" });
      setText(val);
    }
  };

  const appendEmoji = (emoji) => {
    handleTyping(text + emoji);
  };

  const handleStartVoice = async () => {
    if (voiceStartRef.current || voice.isRecording) return;
    voiceStartRef.current = true;
    try {
      setShowEmoji(false);
      await voice.startRecording();
    } catch (err) {
      const message =
        err?.name === "NotAllowedError"
          ? "Microphone access was denied. Allow microphone permission in your device settings."
          : err.message || "Allow microphone access to send voice messages.";
      toast({
        title: "Microphone unavailable",
        description: message,
        variant: "destructive",
      });
    } finally {
      voiceStartRef.current = false;
    }
  };

  const handleSendVoice = async () => {
    if (!voice.blob || voice.blob.size < 500) {
      toast({
        title: "Recording too short",
        description: "Hold the mic a little longer, then send again.",
        variant: "destructive",
      });
      voice.reset();
      return;
    }
    try {
      await sendMessage({
        text: "",
        attachment: { type: "audio", file: voice.blob, durationMs: voice.durationMs },
      });
      voice.reset();
      requestAnimationFrame(() => scrollToBottom());
    } catch (err) {
      toast({ title: "Failed to send voice", description: err.message, variant: "destructive" });
    }
  };

  const handleSettingsUpdated = () => {
    refetchConversation();
    queryClient.invalidateQueries({ queryKey: ["conversations"] });
  };

  const groupName = conversation?.name ?? "Group";
  const memberCount = conversation?.memberCount ?? conversation?.members?.length ?? 0;
  const onlineCount = onlineUsers?.length ?? 0;
  const typingLabel =
    typingUsers?.length > 1
      ? `${typingUsers.slice(0, 2).join(", ")} are typing...`
      : typingUsers?.length === 1
        ? `${typingUsers[0]} is typing...`
        : "Someone is typing...";

  return (
    <div className="flex flex-col h-[100dvh] bg-[#0a0f16] text-white overflow-hidden relative">
      <header className="shrink-0 px-4 py-3 pt-[calc(env(safe-area-inset-top)+0.25rem)] bg-gradient-to-r from-[#101822] to-[#152336] backdrop-blur-xl border-b border-white/5 flex items-center justify-between z-10 shadow-sm relative">
        <Link to="/messages" className="text-[#3b82f6] flex items-center gap-1 -ml-2 p-2 hover:bg-white/5 rounded-full transition-colors">
          <span className="material-symbols-outlined text-[24px]">arrow_back_ios</span>
        </Link>

        <button
          type="button"
          onClick={() => setShowSettings(true)}
          className="flex flex-col items-center absolute left-1/2 -translate-x-1/2 cursor-pointer hover:opacity-90"
        >
          <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-[#3b82f6] to-purple-500 overflow-hidden shadow-sm mb-1 flex items-center justify-center">
            {conversation?.avatar ? (
              <img src={conversation.avatar} alt="" className="w-full h-full object-cover" />
            ) : (
              <span className="material-symbols-outlined text-white text-[20px]">groups</span>
            )}
          </div>
          <h1 className="text-xs font-semibold tracking-wide max-w-[180px] truncate">{groupName}</h1>
          <span className="text-[9px] text-slate-400 font-medium">
            {memberCount} member{memberCount !== 1 ? "s" : ""}
            {onlineCount > 0 ? ` · ${onlineCount} online` : ""}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setShowSettings(true)}
          className="text-slate-400 p-2 hover:bg-white/5 rounded-full transition-colors"
        >
          <span className="material-symbols-outlined text-[24px]">more_horiz</span>
        </button>
      </header>

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
                  {!isMe && isFirstInGroup && (
                    <div className="w-8 h-8 rounded-full bg-slate-800 overflow-hidden mr-2 shrink-0 mt-1">
                      <img src={senderAvatar} alt="" className="w-full h-full object-cover" />
                    </div>
                  )}
                  {!isMe && !isFirstInGroup && <div className="w-8 mr-2 shrink-0" />}

                  <div className={`relative flex flex-col ${isMe ? "items-end" : "items-start"}`}>
                    {!isMe && isFirstInGroup && (
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
                      className={`px-4 py-2.5 text-[15px] leading-relaxed shadow-sm cursor-pointer ${
                        isMe
                          ? "bg-[#3b82f6] text-white"
                          : "bg-[#202938] text-slate-100 border border-white/5"
                      } ${
                        isMe
                          ? `${isFirstInGroup ? "rounded-tl-2xl" : "rounded-tl-lg"} ${isFirstInGroup ? "rounded-tr-2xl" : "rounded-tr-lg"} ${isLastInGroup ? "rounded-br-sm" : "rounded-br-lg"} ${isLastInGroup ? "rounded-bl-2xl" : "rounded-bl-lg"}`
                          : `${isFirstInGroup ? "rounded-tr-2xl" : "rounded-tr-lg"} ${isFirstInGroup ? "rounded-tl-2xl" : "rounded-tl-lg"} ${isLastInGroup ? "rounded-bl-sm" : "rounded-bl-lg"} ${isLastInGroup ? "rounded-br-2xl" : "rounded-br-lg"}`
                      }`}
                    >
                      {message.mediaType === "audio" && message.mediaUrl ? (
                        <VoiceMessageBubble
                          url={message.mediaUrl}
                          isMe={isMe}
                          durationSeconds={message.mediaDuration ?? 0}
                        />
                      ) : (
                        message.text
                      )}
                    </div>
                    <AnimatePresence>
                      {menuMessageId === message.id && (
                        <motion.div
                          initial={{ opacity: 0, scale: 0.95, y: 4 }}
                          animate={{ opacity: 1, scale: 1, y: 0 }}
                          exit={{ opacity: 0, scale: 0.95, y: 4 }}
                          className={`absolute z-20 top-full mt-1 ${isMe ? "right-0" : "left-0"}`}
                          onClick={(e) => e.stopPropagation()}
                        >
                          <div className="flex flex-col gap-1 min-w-[180px]">
                            <button
                              type="button"
                              disabled={isDeleting}
                              onClick={() => handleDeleteMessage(message.id, "me")}
                              className="flex items-center gap-2 px-3 py-2 rounded-xl bg-[#1a2332] border border-white/10 text-slate-200 text-xs font-semibold hover:bg-white/5 disabled:opacity-50 shadow-lg"
                            >
                              <span className="material-symbols-outlined text-[16px]">visibility_off</span>
                              Delete for me
                            </button>
                            {isMe && (
                              <button
                                type="button"
                                disabled={isDeleting}
                                onClick={() => handleDeleteMessage(message.id, "everyone")}
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
                    {isMe && isLastInGroup && message.status && (
                      <span className="text-[10px] text-slate-500 mt-1 mr-1 font-medium">{message.status}</span>
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

      <footer className="shrink-0 px-4 pb-[calc(1rem+env(safe-area-inset-bottom))] pt-2 bg-[#0a0f16] border-t border-white/5 z-10">
        {(voice.isRecording || voice.hasPreview) && (
          <div className="mb-2 flex items-center justify-between gap-3 bg-[#1a2332] border border-white/10 rounded-2xl px-4 py-3">
            <div className="flex items-center gap-3 min-w-0">
              {voice.isRecording && (
                <span className="w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse shrink-0" />
              )}
              <div className="min-w-0">
                <p className="text-sm font-semibold text-white">
                  {voice.isRecording ? "Recording..." : "Voice message ready"}
                </p>
                <p className="text-xs text-slate-400">{voice.durationLabel}</p>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={voice.cancelRecording}
                className="px-3 py-1.5 rounded-full text-xs font-semibold text-slate-300 hover:bg-white/10"
              >
                Cancel
              </button>
              {voice.isRecording ? (
                <button
                  type="button"
                  onClick={voice.stopRecording}
                  className="px-3 py-1.5 rounded-full text-xs font-semibold bg-red-500/20 text-red-300 hover:bg-red-500/30"
                >
                  Stop
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleSendVoice}
                  disabled={isSending}
                  className="px-3 py-1.5 rounded-full text-xs font-semibold bg-[#3b82f6] text-white hover:bg-[#2563eb] disabled:opacity-50"
                >
                  Send
                </button>
              )}
            </div>
          </div>
        )}
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
            disabled={voice.isRecording || voice.hasPreview}
            className="p-2.5 text-slate-400 hover:text-white transition-colors bg-[#253043] rounded-full shrink-0 disabled:opacity-40"
          >
            <span className="material-symbols-outlined text-[20px]">mood</span>
          </button>
          <button
            type="button"
            onClick={voice.isRecording ? voice.stopRecording : handleStartVoice}
            disabled={isSending || voice.hasPreview || Boolean(text.trim())}
            className={`p-2.5 rounded-full shrink-0 transition-all disabled:opacity-40 ${
              voice.isRecording
                ? "bg-red-500 text-white shadow-[0_0_10px_rgba(239,68,68,0.5)]"
                : "text-slate-400 hover:text-white bg-[#253043]"
            }`}
            aria-label={voice.isRecording ? "Stop recording" : "Record voice message"}
          >
            <span className="material-symbols-outlined text-[20px]">{voice.isRecording ? "stop" : "mic"}</span>
          </button>
          <textarea
            value={text}
            onChange={(e) => handleTyping(e.target.value)}
            placeholder="Message the group..."
            disabled={voice.isRecording || voice.hasPreview}
            className="flex-1 bg-transparent border-none text-white text-[15px] px-2 py-3 max-h-24 min-h-[44px] resize-none focus:outline-none hide-scrollbar leading-tight disabled:opacity-50"
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
            disabled={isSending || !text.trim() || voice.isRecording || voice.hasPreview}
            className={`p-2.5 rounded-full shrink-0 flex items-center justify-center transition-all ${
              text.trim() ? "bg-[#3b82f6] text-white shadow-[0_0_10px_rgba(59,130,246,0.6)] hover:bg-[#2563eb]" : "bg-[#253043] text-slate-500"
            }`}
          >
            <span className="material-symbols-outlined text-[20px] ml-0.5">send</span>
          </button>
        </form>
      </footer>

      <AnimatePresence>
        {showSettings && conversation?.type === "group" && (
          <GroupSettingsSheet
            conversation={conversation}
            onClose={() => setShowSettings(false)}
            onUpdated={handleSettingsUpdated}
            onLeave={() => navigate("/messages", { replace: true })}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
