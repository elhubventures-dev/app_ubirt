import { useState, useRef, useEffect } from "react";
import { Link, useParams } from "react-router-dom";
import { useChatMessages } from "@/hooks/useMessages";
import { useToast } from "@/components/ui/use-toast";
import { motion, AnimatePresence } from "framer-motion";

export default function ChatDetail() {
  const { id } = useParams();
  const draftKey = `ubirt.draft.${id}`;
  const [text, setText] = useState(() => localStorage.getItem(draftKey) || "");
  const [attachment, setAttachment] = useState(null);
  const { data: messages = [], isLoading, sendMessage, isSending, isTyping } = useChatMessages(id);
  const { toast } = useToast();
  const scrollRef = useRef(null);

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
      <header className="shrink-0 px-4 py-3 bg-[#101822]/80 backdrop-blur-xl border-b border-white/5 flex items-center justify-between z-10 shadow-sm relative">
        <Link to="/messages" className="text-[#3b82f6] flex items-center gap-1 -ml-2 p-2 hover:bg-white/5 rounded-full transition-colors">
          <span className="material-symbols-outlined text-[24px]">arrow_back_ios</span>
        </Link>
        
        <div className="flex flex-col items-center absolute left-1/2 -translate-x-1/2 cursor-pointer">
          <div className="w-8 h-8 rounded-full bg-slate-800 overflow-hidden shadow-sm mb-1">
             <img src={`https://api.dicebear.com/9.x/notionists/svg?seed=Chat${id}`} alt="Avatar" className="w-full h-full object-cover" />
          </div>
          <h1 className="text-xs font-semibold tracking-wide">User {id}</h1>
          <span className="text-[9px] text-emerald-400 font-medium">Active now</span>
        </div>

        <button className="text-slate-400 p-2 hover:bg-white/5 rounded-full transition-colors">
          <span className="material-symbols-outlined text-[24px]">info</span>
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
              // Group styling logic
              const nextMsg = messages[i+1];
              const isLastInGroup = !nextMsg || nextMsg.role !== message.role;
              const prevMsg = messages[i-1];
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
                         {message.mediaType === "video" ? (
                           <video src={message.mediaUrl} controls className="w-full h-auto" />
                         ) : (
                           <img src={message.mediaUrl} alt="attachment" className="w-full h-auto object-cover" />
                         )}
                      </div>
                    )}
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
        
        {/* Typing indicator */}
        <AnimatePresence>
          {isTyping && (
            <motion.div 
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
              className="self-start bg-[#202938] border border-white/5 rounded-2xl rounded-bl-sm px-4 py-3 flex gap-1.5 shadow-sm mt-2"
            >
               <motion.div className="w-1.5 h-1.5 bg-slate-400 rounded-full" animate={{ y: [0, -5, 0] }} transition={{ duration: 0.6, repeat: Infinity, delay: 0 }} />
               <motion.div className="w-1.5 h-1.5 bg-slate-400 rounded-full" animate={{ y: [0, -5, 0] }} transition={{ duration: 0.6, repeat: Infinity, delay: 0.2 }} />
               <motion.div className="w-1.5 h-1.5 bg-slate-400 rounded-full" animate={{ y: [0, -5, 0] }} transition={{ duration: 0.6, repeat: Infinity, delay: 0.4 }} />
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Input Area */}
      <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-[#0a0f16] via-[#0a0f16]/90 to-transparent pt-10 pb-4 px-4 z-20 flex flex-col gap-2">
        {attachment && (
           <div className="bg-[#1a2332] p-2 rounded-xl self-start relative border border-white/10 shadow-lg">
             <button onClick={() => setAttachment(null)} className="absolute -top-2 -right-2 bg-red-500 rounded-full w-6 h-6 flex items-center justify-center text-white shadow-md z-10">
                <span className="material-symbols-outlined text-[14px]">close</span>
             </button>
             {attachment.type.startsWith("video") ? (
               <video src={URL.createObjectURL(attachment)} className="h-20 rounded-lg object-cover" />
             ) : (
               <img src={URL.createObjectURL(attachment)} className="h-20 rounded-lg object-cover" alt="preview" />
             )}
           </div>
        )}
        <form onSubmit={onSubmit} className="flex items-end gap-2 bg-[#1a2332] border border-white/10 rounded-3xl p-1.5 shadow-xl">
           <label className="p-2.5 text-slate-400 hover:text-white transition-colors bg-[#253043] rounded-full shrink-0 cursor-pointer flex items-center justify-center">
              <span className="material-symbols-outlined text-[20px]">attach_file</span>
              <input type="file" className="hidden" accept="image/*,video/*" onChange={(e) => setAttachment(e.target.files[0])} />
           </label>
           <textarea
             value={text}
             onChange={(e) => {
               const next = e.target.value;
               setText(next);
               localStorage.setItem(draftKey, next);
             }}
             placeholder="Message..."
             className="flex-1 bg-transparent border-none text-white text-[15px] px-2 py-3 max-h-24 min-h-[44px] resize-none focus:outline-none hide-scrollbar leading-tight"
             rows={1}
             onKeyDown={(e) => {
               if (e.key === 'Enter' && !e.shiftKey) {
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
      </div>
    </div>
  );
}
