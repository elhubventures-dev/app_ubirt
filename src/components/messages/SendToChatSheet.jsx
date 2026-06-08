import { useState } from "react";
import { motion } from "framer-motion";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { dataProvider } from "@/api/dataProvider";
import { useToast } from "@/components/ui/use-toast";

export default function SendToChatSheet({ post, onClose }) {
  const { toast } = useToast();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [sendingId, setSendingId] = useState(null);

  const { data: chats = [], isLoading } = useQuery({
    queryKey: ["conversations"],
    queryFn: () => dataProvider.getConversations({ includeArchived: false }),
  });

  const handleSend = async (chat) => {
    if (!post?.id) return;
    setSendingId(chat.id);
    try {
      await dataProvider.sendMessage(chat.id, "", null, {
        sharedPostId: post.id,
      });
      queryClient.invalidateQueries({ queryKey: ["messages", chat.id] });
      queryClient.invalidateQueries({ queryKey: ["conversations"] });
      toast({ title: "Sent to chat", description: `Shared with ${chat.name}` });
      onClose();
      navigate(chat.type === "group" ? `/group/${chat.id}` : `/chat/${chat.id}`);
    } catch (error) {
      toast({ title: "Could not send", description: error.message, variant: "destructive" });
    } finally {
      setSendingId(null);
    }
  };

  return (
    <>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="fixed inset-0 bg-black/60 z-[300] backdrop-blur-sm"
      />
      <motion.div
        initial={{ y: "100%" }}
        animate={{ y: 0 }}
        exit={{ y: "100%" }}
        className="fixed bottom-0 left-0 right-0 z-[301] max-h-[70dvh] bg-[#101822] rounded-t-3xl border-t border-white/10 flex flex-col shadow-2xl"
      >
        <div className="w-12 h-1.5 bg-white/20 rounded-full mx-auto my-3 shrink-0" />
        <h3 className="px-6 font-semibold text-lg text-white mb-2">Send to chat</h3>
        <div className="flex-1 overflow-y-auto px-4 pb-[calc(1rem+env(safe-area-inset-bottom))] space-y-1">
          {isLoading ? (
            <p className="text-slate-400 text-sm text-center py-8">Loading chats...</p>
          ) : !chats.length ? (
            <p className="text-slate-400 text-sm text-center py-8">Start a conversation first.</p>
          ) : (
            chats.map((chat) => (
              <button
                key={chat.id}
                type="button"
                disabled={Boolean(sendingId)}
                onClick={() => handleSend(chat)}
                className="w-full flex items-center gap-3 p-3 rounded-2xl hover:bg-white/5 transition-colors disabled:opacity-50"
              >
                <div className={`w-11 h-11 ${chat.type === "group" ? "rounded-xl" : "rounded-full"} bg-slate-800 overflow-hidden shrink-0`}>
                  {chat.avatar ? (
                    <img src={chat.avatar} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <span className="material-symbols-outlined text-[#3b82f6] w-full h-full flex items-center justify-center">
                      {chat.type === "group" ? "groups" : "person"}
                    </span>
                  )}
                </div>
                <span className="text-sm font-semibold text-white truncate flex-1 text-left">{chat.name}</span>
                {sendingId === chat.id ? (
                  <span className="text-xs text-slate-400">Sending...</span>
                ) : (
                  <span className="material-symbols-outlined text-slate-400">send</span>
                )}
              </button>
            ))
          )}
        </div>
      </motion.div>
    </>
  );
}
