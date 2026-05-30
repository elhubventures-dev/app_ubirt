import { useState, useRef, useEffect } from "react";
import { Link, useParams } from "react-router-dom";
import { useChatMessages } from "@/hooks/useMessages";
import { useToast } from "@/components/ui/use-toast";
import { motion, AnimatePresence } from "framer-motion";

export default function CommunityChat() {
  const { id } = useParams();
  const draftKey = `ubirt.community.draft.${id}`;
  const [text, setText] = useState(() => localStorage.getItem(draftKey) || "");
  const [attachment, setAttachment] = useState(null);
  const { data: messages = [], isLoading, sendMessage, isSending, isTyping, onlineUsers, updateTyping } = useChatMessages(id);
  const { toast } = useToast();
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

  // Auto-scroll to bottom
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
    if (!val && !attachment) return;
    try {
      setText("");
      setAttachment(null);
      localStorage.removeItem(draftKey);
      await sendMessage({ chatId: id, text: val, attachment });
      requestAnimationFrame(() => scrollToBottom());
    } catch (err) {
      toast({ title: "Failed to send", description: err.message, variant: "destructive" });
      setText(val);
    }
  };

  return (
    <div className="flex flex-col h-[100dvh] bg-[#0a0f16] text-white overflow-hidden relative">
      {/* Dynamic Header */}
      <header className="shrink-0 px-4 py-3 bg-gradient-to-r from-[#101822] to-[#152336] backdrop-blur-xl border-b border-white/5 flex items-center justify-between z-10 shadow-sm relative">
        <Link to="/messages" className="text-[#3b82f6] flex items-center gap-1 -ml-2 p-2 hover:bg-white/5 rounded-full transition-colors">
          <span className="material-symbols-outlined text-[24px]">arrow_back_ios</span>
        </Link>
        
        <div className="flex flex-col items-center absolute left-1/2 -translate-x-1/2 cursor-pointer">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-[#3b82f6] to-purple-500 overflow-hidden shadow-sm mb-1 flex items-center justify-center">
             <span className="material-symbols-outlined text-white text-[20px]">groups</span>
          </div>
          <h1 className="text-xs font-semibold tracking-wide flex items-center gap-1">
             Community {id} <span className="material-symbols-outlined text-[12px] text-amber-400">verified</span>
          </h1>
          <span className="text-[9px] text-slate-400 font-medium">
            {onlineUsers ? Math.max(1, onlineUsers.length) : 1} Online
          </span>
        </div>

        <button className="text-slate-400 p-2 hover:bg-white/5 rounded-full transition-colors">
          <span className="material-symbols-outlined text-[24px]">more_horiz</span>
        </button>
      </header>

      {/* Scrollable Messages Area */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-6 flex flex-col gap-1 z-0 hide-scrollbar pb-32">
        {isLoading ? (
          <div className="flex items-center justify-center h-full">
             <div className="animate-spin-slow rounded-full h-8 w-8 border-t-2 border-b-2 border-[#3b82f6]"></div>
          </div>
        ) : (
          <AnimatePresence>
            {messages.map((message, i) => {
              const isMe = message.role === "me";
              const nextMsg = messages[i+1];
              const isLastInGroup = !nextMsg || nextMsg.role !== message.role;
              const prevMsg = messages[i-1];
              const isFirstInGroup = !prevMsg || prevMsg.role !== message.role;

              // Mock sender name for group chat
              const senderName = isMe ? "You" : `Member ${message.id.slice(-2)}`;

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
                       <img src={`https://api.dicebear.com/9.x/notionists/svg?seed=${senderName}`} className="w-full h-full object-cover" />
                    </div>
                  )}
                  {!isMe && !isFirstInGroup && <div className="w-8 mr-2 shrink-0"></div>}

                  <div className={`flex flex-col ${isMe ? "items-end" : "items-start"}`}>
                    {!isMe && isFirstInGroup && (
                      <span className="text-[10px] text-slate-400 mb-1 ml-1 font-semibold">{senderName}</span>
                    )}
                    <div
                      className={`px-4 py-2.5 text-[15px] leading-relaxed shadow-sm relative ${
                        isMe 
                          ? "bg-[#3b82f6] text-white" 
                          : "bg-[#202938] text-slate-100 border border-white/5"
                      } ${
                        isMe
                          ? `${isFirstInGroup ? 'rounded-tl-2xl' : 'rounded-tl-lg'} ${isFirstInGroup ? 'rounded-tr-2xl' : 'rounded-tr-lg'} ${isLastInGroup ? 'rounded-br-sm' : 'rounded-br-lg'} ${isLastInGroup ? 'rounded-bl-2xl' : 'rounded-bl-lg'}`
                          : `${isFirstInGroup ? 'rounded-tr-2xl' : 'rounded-tr-lg'} ${isFirstInGroup ? 'rounded-tl-2xl' : 'rounded-tl-lg'} ${isLastInGroup ? 'rounded-bl-sm' : 'rounded-bl-lg'} ${isLastInGroup ? 'rounded-br-2xl' : 'rounded-br-lg'}`
                      }`}
                    >
                      {message.mediaUrl && (
                        <div className="mb-2 max-w-[200px] rounded-lg overflow-hidden border border-white/10">
                          <img src={message.mediaUrl} alt="Attached" className="w-full object-cover" />
                        </div>
                      )}
                      {message.text}
                      
                      {isLastInGroup && (
                         <div className={`absolute bottom-1 ${isMe ? '-left-10' : '-right-10'} text-[9px] text-slate-500 font-medium px-1`}>
                           {message.timestamp || "12:00"}
                         </div>
                      )}
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
        )}
      </div>

      {/* Typing Indicator & Input Area */}
      <div className="absolute bottom-0 left-0 right-0 p-3 bg-gradient-to-t from-[#0a0f16] via-[#0a0f16] to-transparent pt-10 z-20">
        <AnimatePresence>
          {isTyping && (
            <motion.div 
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 10 }}
              className="px-4 pb-2 text-[10px] text-slate-400 font-medium flex items-center gap-1"
            >
              <div className="flex gap-0.5">
                <span className="w-1 h-1 rounded-full bg-slate-400 animate-bounce" style={{ animationDelay: '0ms' }} />
                <span className="w-1 h-1 rounded-full bg-slate-400 animate-bounce" style={{ animationDelay: '150ms' }} />
                <span className="w-1 h-1 rounded-full bg-slate-400 animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
              Someone is typing...
            </motion.div>
          )}
        </AnimatePresence>
        <form onSubmit={onSubmit} className="flex items-end gap-2 bg-[#1a2332] p-2 rounded-[2rem] border border-white/10 shadow-lg relative">
          
          <button type="button" className="p-3 text-slate-400 hover:text-white rounded-full hover:bg-white/5 transition-colors shrink-0">
            <span className="material-symbols-outlined text-[24px]">add_circle</span>
          </button>
          
          <div className="flex-1 relative">
            <textarea
              value={text}
              onChange={(e) => handleTyping(e.target.value)}
              placeholder="Message the community..."
              className="w-full bg-transparent border-none focus:outline-none focus:ring-0 text-white placeholder-slate-500 resize-none py-3 max-h-32 text-[15px] block hide-scrollbar"
              rows={1}
              onInput={(e) => {
                e.target.style.height = 'auto';
                e.target.style.height = Math.min(e.target.scrollHeight, 120) + 'px';
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  onSubmit(e);
                }
              }}
            />
          </div>

          {(text.trim() || attachment) ? (
            <button
              type="submit"
              disabled={isSending}
              className="p-3 bg-[#3b82f6] text-white rounded-full hover:bg-blue-600 active:scale-95 transition-all shrink-0 shadow-[0_0_15px_rgba(59,130,246,0.4)] mr-1 mb-1"
            >
              <span className="material-symbols-outlined text-[20px] ml-0.5 mt-0.5">send</span>
            </button>
          ) : (
            <button type="button" className="p-3 text-slate-400 hover:text-white rounded-full hover:bg-white/5 transition-colors shrink-0 mr-1 mb-1">
              <span className="material-symbols-outlined text-[24px]">mic</span>
            </button>
          )}
        </form>
      </div>
    </div>
  );
}
