import { useState } from "react";
import { Link } from "react-router-dom";
import { useConversations } from "@/hooks/useMessages";
import { SkeletonRow } from "@/components/ui/SkeletonRow";
import { motion, AnimatePresence } from "framer-motion";

export default function Messages() {
  const { data: chats = [], isLoading } = useConversations();
  const [activeTab, setActiveTab] = useState("direct"); // "direct" | "communities"

  const communities = [
    { id: "c1", name: "Creator1 VIPs", members: 124, unread: 5, lastMessage: "Welcome to the VIP group!" },
    { id: "c2", name: "Tech Enthusiasts", members: 89, unread: 0, lastMessage: "Check out this new gadget." },
  ];

  return (
    <div className="flex flex-col min-h-full pb-20 pt-4 px-2 sm:px-4">
      <div className="flex items-center justify-between px-2 mb-6">
        <h1 className="text-2xl font-bold text-white tracking-tight">Messages</h1>
        <button className="text-[#3b82f6] p-2 hover:bg-[#3b82f6]/10 rounded-full transition-colors">
          <span className="material-symbols-outlined text-[24px]">edit_square</span>
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-4 border-b border-white/10 mb-4 px-2">
        {["direct", "communities"].map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`py-2 text-sm font-semibold capitalize relative transition-colors ${activeTab === tab ? "text-[#3b82f6]" : "text-slate-400 hover:text-slate-200"}`}
          >
            {tab}
            {activeTab === tab && (
              <motion.div layoutId="messagesTabIndicator" className="absolute bottom-[-1px] left-0 right-0 h-0.5 bg-[#3b82f6]" />
            )}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="space-y-4 px-2" aria-label="Loading conversations">
          <SkeletonRow height="lg" count={5} />
        </div>
      ) : !chats.length ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <span className="material-symbols-outlined text-[64px] text-slate-700">chat_bubble</span>
          <p className="text-slate-300 font-semibold mt-4">No messages yet</p>
          <p className="text-sm text-slate-500 mt-1">Start a conversation with a creator or friend.</p>
        </div>
      ) : (
        <div className="space-y-1">
          <AnimatePresence mode="popLayout">
            {(activeTab === "direct" ? chats : communities).map((chat, i) => (
              <motion.div
                key={chat.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ delay: i * 0.05 }}
              >
                <Link
                  to={activeTab === "direct" ? `/chat/${chat.id}` : `/community/${chat.id}`}
                  className="flex items-center gap-4 p-3 rounded-2xl hover:bg-white/5 transition-colors group relative"
                >
                  {/* Avatar */}
                  <div className="relative shrink-0">
                    <div className={`w-14 h-14 rounded-full ${activeTab === "communities" ? "bg-gradient-to-br from-[#3b82f6] to-purple-500 rounded-xl" : "bg-slate-800"} overflow-hidden shadow-md flex items-center justify-center`}>
                      {activeTab === "communities" ? (
                         <span className="material-symbols-outlined text-white text-2xl">groups</span>
                      ) : (
                         <img src={`https://api.dicebear.com/9.x/notionists/svg?seed=${chat.name}`} alt={chat.name} className="w-full h-full object-cover" />
                      )}
                    </div>
                    {/* Online indicator for direct messages */}
                    {activeTab === "direct" && i % 3 !== 0 && (
                       <div className="absolute bottom-0 right-0 w-3.5 h-3.5 bg-emerald-500 border-2 border-[#101822] rounded-full group-hover:border-[#1a2332] transition-colors" />
                    )}
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-baseline mb-0.5">
                      <p className={`font-semibold text-[15px] truncate ${chat.unread > 0 ? "text-white" : "text-slate-200"}`}>
                        {chat.name}
                      </p>
                      <span className="text-xs text-slate-500 shrink-0 ml-2">{chat.updatedAt || "2h"}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <p className={`text-[13px] truncate ${chat.unread > 0 ? "text-white font-medium" : "text-slate-400"}`}>
                        {chat.lastMessage || "Sent a message"}
                      </p>
                    </div>
                  </div>

                  {/* Unread Badge */}
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
