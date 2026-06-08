import { useState, useRef, useEffect, useMemo } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { AnimatePresence } from "framer-motion";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useChatMessages, useConversation } from "@/hooks/useMessages";
import { useVoiceRecorder } from "@/hooks/useVoiceRecorder";
import ChatMessageList from "@/components/messages/ChatMessageList";
import ChatOptionsSheet from "@/components/messages/ChatOptionsSheet";
import { formatPresenceStatus } from "@/lib/presence";
import { getChatTheme } from "@/lib/chatThemes";
import { useToast } from "@/components/ui/use-toast";
import { dataProvider } from "@/api/dataProvider";
import { useCall } from "@/context/CallContext";

const QUICK_EMOJIS = ["😀", "😂", "❤️", "🔥", "👍", "🎉", "😮", "🙏", "💯", "✨"];

export default function ChatDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const draftKey = `ubirt.draft.${id}`;
  const [text, setText] = useState(() => localStorage.getItem(draftKey) || "");
  const [showEmoji, setShowEmoji] = useState(false);
  const [showOptions, setShowOptions] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [replyTo, setReplyTo] = useState(null);
  const [menuMessageId, setMenuMessageId] = useState(null);
  const { data: conversation, refetch: refetchConversation } = useConversation(id);
  const {
    data: messages = [],
    isLoading,
    sendMessage,
    isSending,
    deleteMessage,
    isDeleting,
    toggleReaction,
    searchMessages,
    isTyping,
    peerPresent,
    updateTyping,
  } = useChatMessages(id);
  const { toast } = useToast();
  const { placeCall, isBusy: isCallBusy } = useCall();
  const theme = getChatTheme(conversation?.chatTheme);
  const presence = useMemo(
    () => formatPresenceStatus(conversation?.lastSeenAt, peerPresent),
    [conversation?.lastSeenAt, peerPresent]
  );
  const avatarSrc = conversation?.avatar || `https://api.dicebear.com/9.x/notionists/svg?seed=${conversation?.name || id}`;
  const profileLink = conversation?.username ? `/user/${conversation.username}` : null;
  const scrollRef = useRef(null);
  const typingTimeoutRef = useRef(null);
  const voiceStartRef = useRef(false);
  const voice = useVoiceRecorder();

  const chatMutation = useMutation({
    mutationFn: async ({ type, ...payload }) => {
      if (type === "mute") return dataProvider.setConversationMuted(id, payload.hours);
      if (type === "archive") return dataProvider.setConversationArchived(id, payload.archived);
      if (type === "theme") return dataProvider.updateChatTheme(id, payload.theme);
      return null;
    },
    onSuccess: () => {
      refetchConversation();
      queryClient.invalidateQueries({ queryKey: ["conversations"] });
    },
  });

  useEffect(() => {
    if (conversation?.type === "group") {
      navigate(`/group/${id}`, { replace: true });
    }
  }, [conversation, id, navigate]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isTyping]);

  useEffect(() => {
    if (!showSearch || searchQuery.trim().length < 2) {
      setSearchResults([]);
      return undefined;
    }
    const timer = setTimeout(async () => {
      try {
        const results = await searchMessages(searchQuery.trim());
        setSearchResults(results);
      } catch {
        setSearchResults([]);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery, showSearch, searchMessages]);

  const handleTyping = (val) => {
    setText(val);
    localStorage.setItem(draftKey, val);
    if (updateTyping) {
      updateTyping(true);
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = setTimeout(() => updateTyping(false), 1500);
    }
  };

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
      await sendMessage({ text: val, replyToId: replyTo?.id ?? null });
      setReplyTo(null);
    } catch (err) {
      toast({ title: "Failed to send", description: err.message, variant: "destructive" });
      setText(val);
    }
  };

  const appendEmoji = (emoji) => handleTyping(text + emoji);

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
      toast({ title: "Microphone unavailable", description: message, variant: "destructive" });
    } finally {
      voiceStartRef.current = false;
    }
  };

  const handleSendVoice = async () => {
    if (!voice.blob || voice.blob.size < 500) {
      toast({ title: "Recording too short", description: "Hold the mic a little longer, then send again.", variant: "destructive" });
      voice.reset();
      return;
    }
    try {
      await sendMessage({
        text: "",
        attachment: { type: "audio", file: voice.blob, durationMs: voice.durationMs },
        replyToId: replyTo?.id ?? null,
      });
      setReplyTo(null);
      voice.reset();
    } catch (err) {
      toast({ title: "Failed to send voice", description: err.message, variant: "destructive" });
    }
  };

  const handleArchive = async (archived) => {
    try {
      await chatMutation.mutateAsync({ type: "archive", archived });
      toast({ title: archived ? "Chat archived" : "Moved to inbox" });
      if (archived) navigate("/messages");
    } catch (err) {
      toast({ title: "Could not update chat", description: err.message, variant: "destructive" });
    }
  };

  const handleStartCall = async (callType) => {
    try {
      await placeCall(id, callType);
    } catch (err) {
      toast({ title: "Call failed", description: err.message, variant: "destructive" });
    }
  };

  const isDirectChat = conversation?.type === "direct";

  return (
    <div className={`flex flex-col h-[100dvh] ${theme.page} text-white overflow-hidden relative`}>
      <header className={`shrink-0 grid grid-cols-[auto_1fr_auto] items-center gap-2 px-2 pt-[calc(env(safe-area-inset-top)+0.25rem)] pb-2 ${theme.header} backdrop-blur-xl border-b border-white/5 z-10 shadow-sm`}>
        <Link to="/messages" className="text-[#3b82f6] p-1.5 hover:bg-white/5 rounded-full transition-colors">
          <span className="material-symbols-outlined text-[22px]">arrow_back_ios</span>
        </Link>

        {profileLink ? (
          <Link to={profileLink} className="flex items-center justify-center gap-2 min-w-0 hover:opacity-90 transition-opacity">
            <div className="w-9 h-9 rounded-full bg-slate-800 overflow-hidden shadow-sm shrink-0">
              <img src={avatarSrc} alt={conversation?.name || "User"} className="w-full h-full object-cover" />
            </div>
            <div className="min-w-0 text-left">
              <h1 className="text-sm font-semibold truncate leading-tight">{conversation?.name || "Chat"}</h1>
              <span className={`text-[10px] font-medium ${presence.isActive ? "text-emerald-400" : "text-slate-500"}`}>{presence.label}</span>
            </div>
          </Link>
        ) : (
          <div className="flex items-center justify-center gap-2 min-w-0">
            <div className="w-9 h-9 rounded-full bg-slate-800 overflow-hidden shadow-sm shrink-0">
              <img src={avatarSrc} alt={conversation?.name || "User"} className="w-full h-full object-cover" />
            </div>
            <div className="min-w-0 text-left">
              <h1 className="text-sm font-semibold truncate leading-tight">{conversation?.name || "Chat"}</h1>
              <span className={`text-[10px] font-medium ${presence.isActive ? "text-emerald-400" : "text-slate-500"}`}>{presence.label}</span>
            </div>
          </div>
        )}

        <div className="flex items-center gap-0.5">
          {isDirectChat ? (
            <>
              <button
                type="button"
                disabled={isCallBusy}
                onClick={() => handleStartCall("audio")}
                className="min-w-9 min-h-9 flex items-center justify-center text-slate-300 hover:bg-white/5 rounded-full transition-colors disabled:opacity-40"
                aria-label="Audio call"
              >
                <span className="material-symbols-outlined text-[22px]">call</span>
              </button>
              <button
                type="button"
                disabled={isCallBusy}
                onClick={() => handleStartCall("video")}
                className="min-w-9 min-h-9 flex items-center justify-center text-slate-300 hover:bg-white/5 rounded-full transition-colors disabled:opacity-40"
                aria-label="Video call"
              >
                <span className="material-symbols-outlined text-[22px]">videocam</span>
              </button>
            </>
          ) : null}
          <button
            type="button"
            onClick={() => setShowOptions(true)}
            className="min-w-9 min-h-9 flex items-center justify-center text-slate-400 hover:bg-white/5 rounded-full transition-colors"
          >
            <span className="material-symbols-outlined text-[22px]">more_horiz</span>
          </button>
        </div>
      </header>

      {showSearch && (
        <div className="shrink-0 px-4 py-2 border-b border-white/5 bg-[#101822]/90 z-10">
          <div className="flex items-center gap-2">
            <input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search messages..."
              className="flex-1 bg-[#1a2332] border border-white/10 rounded-xl px-3 py-2 text-sm text-white focus:outline-none"
              autoFocus
            />
            <button type="button" onClick={() => { setShowSearch(false); setSearchQuery(""); }} className="text-slate-400 text-sm px-2">
              Close
            </button>
          </div>
          {searchResults.length > 0 && (
            <div className="mt-2 max-h-32 overflow-y-auto space-y-1">
              {searchResults.map((msg) => (
                <button
                  key={msg.id}
                  type="button"
                  onClick={() => { setShowSearch(false); setSearchQuery(""); }}
                  className="w-full text-left px-2 py-1.5 rounded-lg hover:bg-white/5 text-xs text-slate-300 truncate"
                >
                  {msg.text}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      <ChatMessageList
        messages={messages}
        isLoading={isLoading}
        scrollRef={scrollRef}
        conversation={conversation}
        theme={theme}
        menuMessageId={menuMessageId}
        setMenuMessageId={setMenuMessageId}
        onReply={setReplyTo}
        onDelete={handleDeleteMessage}
        onToggleReaction={(messageId, emoji) => toggleReaction({ messageId, emoji })}
        isDeleting={isDeleting}
        isTyping={isTyping}
      />

      <footer className={`shrink-0 px-4 pb-[calc(1rem+env(safe-area-inset-bottom))] pt-2 ${theme.footer} border-t border-white/5 z-10`}>
        {replyTo && (
          <div className="mb-2 flex items-center justify-between gap-2 bg-[#1a2332] border border-white/10 rounded-xl px-3 py-2">
            <div className="min-w-0">
              <p className="text-[10px] text-[#3b82f6] font-semibold">Replying to {replyTo.senderName ?? "message"}</p>
              <p className="text-xs text-slate-300 truncate">{replyTo.mediaType === "audio" ? "Voice message" : replyTo.text}</p>
            </div>
            <button type="button" onClick={() => setReplyTo(null)} className="text-slate-400 shrink-0">
              <span className="material-symbols-outlined text-[18px]">close</span>
            </button>
          </div>
        )}
        {(voice.isRecording || voice.hasPreview) && (
          <div className="mb-2 flex items-center justify-between gap-3 bg-[#1a2332] border border-white/10 rounded-2xl px-4 py-3">
            <div className="flex items-center gap-3 min-w-0">
              {voice.isRecording && <span className="w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse shrink-0" />}
              <div className="min-w-0">
                <p className="text-sm font-semibold text-white">{voice.isRecording ? "Recording..." : "Voice message ready"}</p>
                <p className="text-xs text-slate-400">{voice.durationLabel}</p>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button type="button" onClick={voice.cancelRecording} className="px-3 py-1.5 rounded-full text-xs font-semibold text-slate-300 hover:bg-white/10">Cancel</button>
              {voice.isRecording ? (
                <button type="button" onClick={voice.stopRecording} className="px-3 py-1.5 rounded-full text-xs font-semibold bg-red-500/20 text-red-300 hover:bg-red-500/30">Stop</button>
              ) : (
                <button type="button" onClick={handleSendVoice} disabled={isSending} className="px-3 py-1.5 rounded-full text-xs font-semibold bg-[#3b82f6] text-white hover:bg-[#2563eb] disabled:opacity-50">Send</button>
              )}
            </div>
          </div>
        )}
        {showEmoji && (
          <div className="flex flex-wrap gap-2 bg-[#1a2332] border border-white/10 rounded-2xl p-3 mb-2">
            {QUICK_EMOJIS.map((emoji) => (
              <button key={emoji} type="button" onClick={() => appendEmoji(emoji)} className="text-xl hover:scale-110 transition-transform">{emoji}</button>
            ))}
          </div>
        )}
        <form onSubmit={onSubmit} className="flex items-end gap-2 bg-[#1a2332] border border-white/10 rounded-3xl p-1.5 shadow-xl">
          <button type="button" onClick={() => setShowEmoji((v) => !v)} disabled={voice.isRecording || voice.hasPreview} className="p-2.5 text-slate-400 hover:text-white transition-colors bg-[#253043] rounded-full shrink-0 disabled:opacity-40">
            <span className="material-symbols-outlined text-[20px]">mood</span>
          </button>
          <button type="button" onClick={voice.isRecording ? voice.stopRecording : handleStartVoice} disabled={isSending || voice.hasPreview || Boolean(text.trim())} className={`p-2.5 rounded-full shrink-0 transition-all disabled:opacity-40 ${voice.isRecording ? "bg-red-500 text-white shadow-[0_0_10px_rgba(239,68,68,0.5)]" : "text-slate-400 hover:text-white bg-[#253043]"}`}>
            <span className="material-symbols-outlined text-[20px]">{voice.isRecording ? "stop" : "mic"}</span>
          </button>
          <textarea
            value={text}
            onChange={(e) => handleTyping(e.target.value)}
            placeholder="Message..."
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
          <button type="submit" disabled={isSending || !text.trim() || voice.isRecording || voice.hasPreview} className={`p-2.5 rounded-full shrink-0 flex items-center justify-center transition-all ${text.trim() ? "bg-[#3b82f6] text-white shadow-[0_0_10px_rgba(59,130,246,0.6)] hover:bg-[#2563eb]" : "bg-[#253043] text-slate-500"}`}>
            <span className="material-symbols-outlined text-[20px] ml-0.5">send</span>
          </button>
        </form>
      </footer>

      <AnimatePresence>
        {showOptions && (
          <ChatOptionsSheet
            conversation={conversation}
            onClose={() => setShowOptions(false)}
            onSearch={() => setShowSearch(true)}
            onMute={(hours) => chatMutation.mutateAsync({ type: "mute", hours }).then(() => toast({ title: hours ? "Notifications muted" : "Notifications unmuted" }))}
            onArchive={handleArchive}
            onThemeChange={(themeId) => chatMutation.mutateAsync({ type: "theme", theme: themeId }).then(() => toast({ title: "Theme updated" }))}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
