import { Link } from "react-router-dom";
import { useConversations } from "@/hooks/useMessages";
import { SkeletonRow } from "@/components/ui/SkeletonRow";
import { motion, AnimatePresence } from "framer-motion";

export default function Messages() {
  const { data: chats = [], isLoading } = useConversations();

  return (
    <div className="flex flex-col min-h-full pb-20 pt-4 px-2 sm:px-4">
      <div className="flex items-center justify-between px-2 mb-6">
        <h1 className="text-2xl font-bold text-white tracking-tight">Messages</h1>
      </div>

      {isLoading ? (
        <div className="space-y-4 px-2" aria-label="Loading conversations">
          <SkeletonRow height="lg" count={5} />
        </div>
      ) : !chats.length ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <span className="material-symbols-outlined text-[64px] text-slate-700">chat_bubble</span>
          <p className="text-slate-300 font-semibold mt-4">No messages yet</p>
          <p className="text-sm text-slate-500 mt-1">Start a conversation from a creator profile.</p>
        </div>
      ) : (
        <div className="space-y-1">
          <AnimatePresence mode="popLayout">
            {chats.map((chat, i) => (
              <motion.div
                key={chat.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ delay: i * 0.05 }}
              >
                <Link
                  to={`/chat/${chat.id}`}
                  className="flex items-center gap-4 p-3 rounded-2xl hover:bg-white/5 transition-colors group relative"
                >
                  <div className="relative shrink-0">
                    <div className="w-14 h-14 rounded-full bg-slate-800 overflow-hidden shadow-md flex items-center justify-center">
                      <img src={`https://api.dicebear.com/9.x/notionists/svg?seed=${chat.name}`} alt={chat.name} className="w-full h-full object-cover" />
                    </div>
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-baseline mb-0.5">
                      <p className={`font-semibold text-[15px] truncate ${chat.unread > 0 ? "text-white" : "text-slate-200"}`}>
                        {chat.name}
                      </p>
                      <span className="text-xs text-slate-500 shrink-0 ml-2">{chat.updatedAt || ""}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <p className={`text-[13px] truncate ${chat.unread > 0 ? "text-white font-medium" : "text-slate-400"}`}>
                        {chat.lastMessage || "Sent a message"}
                      </p>
                    </div>
                  </div>

                  {chat.unread > 0 && (
                    <div className="shrink-0 flex items-center justify-center w-5 h-5 rounded-full bg-[#3b82f6] text-[10px] font-bold text-white shadow-[0_0_8px_rgba(59,130,246,0.5)]">
                      {chat.unread}
                    </div>
                  )}
                </Link>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}
