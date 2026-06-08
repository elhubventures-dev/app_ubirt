import { useState, useRef, useEffect } from "react";
import { Link } from "react-router-dom";
import { useAIChat } from "@/hooks/useAIChat";
import { useToast } from "@/components/ui/use-toast";
import { motion, AnimatePresence } from "framer-motion";

const presets = [
  "Write a 20s reel script about AI tips.",
  "Generate a video hook for productivity.",
  "Suggest three creator growth experiments.",
];

export default function AIChat() {
  const draftStorageKey = "ubirt.ai.promptDraft";
  const [prompt, setPrompt] = useState(() => localStorage.getItem(draftStorageKey) ?? "");
  const {
    data: messages = [],
    isLoading,
    askAi,
    retryLast,
    clearConversation,
    meta,
    isAsking,
  } = useAIChat();
  const { toast } = useToast();
  const scrollRef = useRef(null);

  // Auto-scroll to bottom
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isAsking]);

  const submitPrompt = async (value) => {
    const finalPrompt = value.trim();
    if (!finalPrompt) return;
    try {
      await askAi(finalPrompt);
      setPrompt("");
      localStorage.removeItem(draftStorageKey);
    } catch (error) {
      toast({ title: "AI request failed", description: error.message, variant: "destructive" });
    }
  };

  return (
    <div className="flex flex-col h-[100dvh] bg-[#0a0f16] text-white overflow-hidden relative">
      {/* Background aesthetics */}
      <div className="absolute top-0 right-0 w-[60%] h-[40%] bg-[#8b5cf6]/10 blur-[150px] rounded-full pointer-events-none z-0" />
      <div className="absolute bottom-0 left-[-20%] w-[50%] h-[50%] bg-[#3b82f6]/10 blur-[150px] rounded-full pointer-events-none z-0" />

      {/* Header */}
      <header className="shrink-0 px-4 py-3 bg-[#101822]/80 backdrop-blur-xl border-b border-white/5 flex items-center justify-between z-10 shadow-sm relative">
        <Link to="/" className="text-[#3b82f6] flex items-center gap-1 hover:bg-white/5 rounded-full p-1.5 -ml-1.5 transition-colors">
          <span className="material-symbols-outlined text-[24px]">arrow_back_ios</span>
        </Link>
        <div className="flex flex-col items-center absolute left-1/2 -translate-x-1/2">
           <div className="w-8 h-8 bg-gradient-to-br from-[#8b5cf6] to-[#3b82f6] rounded-xl flex items-center justify-center mb-1 shadow-[0_0_10px_rgba(139,92,246,0.5)]">
             <span className="material-symbols-outlined text-[18px] text-white">smart_toy</span>
           </div>
           <h1 className="text-xs font-bold tracking-wide">{meta?.title ?? "UBIRT AI"}</h1>
        </div>
        <div className="flex gap-1">
          <button onClick={retryLast} disabled={isAsking || messages.length === 0} className="text-slate-400 p-2 hover:bg-white/5 hover:text-white rounded-full transition-colors" title="Retry Last Response">
            <span className="material-symbols-outlined text-[22px]">refresh</span>
          </button>
          <button onClick={clearConversation} className="text-slate-400 p-2 hover:bg-red-500/10 hover:text-red-400 rounded-full transition-colors" title="Clear Chat">
            <span className="material-symbols-outlined text-[22px]">delete_sweep</span>
          </button>
        </div>
      </header>

      {/* Scrollable Messages Area */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-6 flex flex-col gap-4 z-0 hide-scrollbar pb-40">
        {isLoading ? (
          <div className="flex items-center justify-center h-full">
             <div className="animate-spin-slow rounded-full h-8 w-8 border-t-2 border-b-2 border-[#8b5cf6]"></div>
          </div>
        ) : (
          <AnimatePresence>
            {messages.length === 0 && !isAsking && (
               <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col items-center justify-center h-full text-center px-4">
                  <div className="w-20 h-20 bg-gradient-to-br from-[#8b5cf6]/20 to-[#3b82f6]/20 rounded-full flex items-center justify-center mb-4 border border-[#8b5cf6]/30">
                     <span className="material-symbols-outlined text-[40px] text-[#8b5cf6]">smart_toy</span>
                  </div>
                  <h2 className="text-xl font-bold mb-2">How can I help you create?</h2>
                  <p className="text-sm text-slate-400 max-w-xs">Ask me to write scripts, generate hooks, or brainstorm content ideas.</p>
               </motion.div>
            )}

            {messages.map((message) => {
              const isAi = message.role === "assistant";
              return (
                <motion.div
                  key={message.id}
                  initial={{ opacity: 0, y: 10, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  layout
                  className={`flex max-w-[85%] ${isAi ? "self-start" : "self-end"}`}
                >
                  {isAi && (
                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#8b5cf6] to-[#3b82f6] shrink-0 mr-3 flex items-center justify-center shadow-md">
                      <span className="material-symbols-outlined text-[16px] text-white">smart_toy</span>
                    </div>
                  )}
                  <div className={`px-4 py-3 text-[15px] leading-relaxed shadow-sm relative group ${
                      isAi 
                        ? "bg-[#1a2332] text-slate-200 border border-white/10 rounded-2xl rounded-tl-sm" 
                        : "bg-[#3b82f6] text-white rounded-2xl rounded-tr-sm"
                    }`}
                  >
                    {message.text}
                    {isAi && (
                      <button 
                        className="absolute -right-10 bottom-0 p-1.5 text-slate-400 hover:text-white bg-white/5 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                        onClick={() => {
                          navigator.clipboard.writeText(message.text);
                          toast({ title: "Copied to clipboard" });
                        }}
                      >
                         <span className="material-symbols-outlined text-[16px]">content_copy</span>
                      </button>
                    )}
                  </div>
                </motion.div>
              );
            })}

            {/* AI Typing Indicator */}
            {isAsking && (
              <motion.div 
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="self-start flex max-w-[85%]"
              >
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#8b5cf6] to-[#3b82f6] shrink-0 mr-3 flex items-center justify-center shadow-[0_0_10px_rgba(139,92,246,0.6)]">
                  <span className="material-symbols-outlined text-[16px] text-white animate-pulse">smart_toy</span>
                </div>
                <div className="bg-[#1a2332] border border-white/10 rounded-2xl rounded-tl-sm px-5 py-4 flex gap-1.5 shadow-sm items-center">
                   <motion.div className="w-1.5 h-1.5 bg-[#8b5cf6] rounded-full" animate={{ y: [0, -4, 0] }} transition={{ duration: 0.6, repeat: Infinity, delay: 0 }} />
                   <motion.div className="w-1.5 h-1.5 bg-[#8b5cf6] rounded-full" animate={{ y: [0, -4, 0] }} transition={{ duration: 0.6, repeat: Infinity, delay: 0.2 }} />
                   <motion.div className="w-1.5 h-1.5 bg-[#8b5cf6] rounded-full" animate={{ y: [0, -4, 0] }} transition={{ duration: 0.6, repeat: Infinity, delay: 0.4 }} />
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        )}
      </div>

      {/* Input Area */}
      <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-[#0a0f16] via-[#0a0f16]/90 to-transparent pt-16 pb-4 px-4 z-20">
        {/* Floating Presets */}
        <div className="flex gap-2 overflow-x-auto hide-scrollbar mb-3 pb-1">
           {presets.map((item) => (
             <button
               key={item}
               onClick={() => submitPrompt(item)}
               disabled={isAsking}
               className="shrink-0 px-4 py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-full text-xs font-medium text-slate-300 transition-colors whitespace-nowrap shadow-lg backdrop-blur-md"
             >
               {item}
             </button>
           ))}
        </div>

        {/* Input Bar */}
        <form onSubmit={(e) => { e.preventDefault(); submitPrompt(prompt); }} className="flex items-end gap-2 bg-[#1a2332] border border-[#8b5cf6]/30 rounded-3xl p-1.5 shadow-[0_0_20px_rgba(139,92,246,0.1)] relative">
           <textarea
             value={prompt}
             onChange={(e) => {
               const next = e.target.value;
               setPrompt(next);
               localStorage.setItem(draftStorageKey, next);
             }}
             placeholder="Ask UBIRT AI to brainstorm..."
             className="flex-1 bg-transparent border-none text-white text-[15px] px-3 py-3 max-h-24 min-h-[44px] resize-none focus:outline-none hide-scrollbar leading-tight placeholder-slate-500"
             rows={1}
             onKeyDown={(e) => {
               if (e.key === 'Enter' && !e.shiftKey) {
                 e.preventDefault();
                 submitPrompt(prompt);
               }
             }}
           />
           <button 
              type="submit" 
              disabled={isAsking || !prompt.trim()} 
              className={`p-2.5 rounded-full shrink-0 flex items-center justify-center transition-all ${
                prompt.trim() ? "bg-gradient-to-r from-[#8b5cf6] to-[#3b82f6] text-white shadow-[0_0_15px_rgba(139,92,246,0.6)] hover:scale-105" : "bg-[#253043] text-slate-500"
              }`}
            >
              <span className="material-symbols-outlined text-[20px] ml-0.5">arrow_upward</span>
           </button>
        </form>
      </div>
    </div>
  );
}
