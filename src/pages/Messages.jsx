import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import PullToRefresh from "@/components/mobile/PullToRefresh";
import { useConversations } from "@/hooks/useMessages";
import { SkeletonRow } from "@/components/ui/SkeletonRow";
import { motion, AnimatePresence } from "framer-motion";
import { dataProvider } from "@/api/dataProvider";
import { useToast } from "@/components/ui/use-toast";
import NewConversationSheet from "@/components/messages/NewConversationSheet";
import NewGroupSheet from "@/components/messages/NewGroupSheet";
import { isNativePlatform } from "@/lib/platform";

export default function Messages() {
  const [tab, setTab] = useState("inbox");
  const { data: chats = [], isLoading } = useConversations({ includeArchived: tab === "archived" });
  const [showNewChat, setShowNewChat] = useState(false);
  const [showNewGroup, setShowNewGroup] = useState(false);
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const startChatMutation = useMutation({
    mutationFn: (userId) => dataProvider.startConversation(userId),
    onSuccess: (conv) => {
      queryClient.invalidateQueries({ queryKey: ["conversations"] });
      setShowNewChat(false);
      navigate(`/chat/${conv.id}`);
    },
    onError: (error) => {
      toast({ title: "Could not start chat", description: error.message, variant: "destructive" });
    },
  });

  const createGroupMutation = useMutation({
    mutationFn: ({ title, memberIds }) => dataProvider.createGroupConversation(title, memberIds),
    onSuccess: (conv) => {
      queryClient.invalidateQueries({ queryKey: ["conversations"] });
      setShowNewGroup(false);
      navigate(`/group/${conv.id}`);
    },
    onError: (error) => {
      const msg = error.message || "Something went wrong.";
      const needsMigration = /column|function|invite_code|create_group/i.test(msg);
      toast({
        title: "Could not create group",
        description: needsMigration
          ? `${msg} Run migration 027_group_chat.sql in Supabase.`
          : msg,
        variant: "destructive",
      });
    },
  });

  const isNative = isNativePlatform();

  const refreshInbox = async () => {
    await queryClient.invalidateQueries({ queryKey: ["conversations"] });
  };

  return (
    <PullToRefresh onRefresh={refreshInbox} className="min-h-full">
    <div className="flex flex-col min-h-full pb-24 pt-2 px-2 sm:px-4">
      <div className="px-2 mb-4">
        <div className="flex gap-2 mb-3 px-2">
          {[
            { id: "inbox", label: "Inbox" },
            { id: "archived", label: "Archived" },
          ].map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setTab(item.id)}
              className={`flex-1 py-2 rounded-xl text-sm font-semibold transition-colors ${
                tab === item.id ? "bg-[#3b82f6] text-white" : "bg-white/5 text-slate-400 hover:bg-white/10"
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>
        <div className="flex gap-2 sticky top-[calc(env(safe-area-inset-top)+4.5rem)] z-30 py-2 -mx-2 px-2 bg-[#101822]/95 backdrop-blur-md">
          <button
            type="button"
            onClick={() => setShowNewChat(true)}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-2xl bg-white/5 border border-white/10 text-white font-semibold text-sm hover:bg-white/10 transition-colors"
          >
            <span className="material-symbols-outlined text-[20px] text-[#3b82f6]">edit_square</span>
            New Chat
          </button>
          <button
            type="button"
            onClick={() => setShowNewGroup(true)}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-2xl bg-[#3b82f6]/15 border border-[#3b82f6]/30 text-white font-semibold text-sm hover:bg-[#3b82f6]/25 transition-colors"
          >
            <span className="material-symbols-outlined text-[20px] text-[#3b82f6]">groups</span>
            New Group
          </button>
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-4 px-2" aria-label="Loading conversations">
          <SkeletonRow height="lg" count={5} />
        </div>
      ) : !chats.length ? (
        <div className="flex flex-col items-center justify-center py-16 text-center px-4">
          <span className="material-symbols-outlined text-[64px] text-slate-700">
            {tab === "archived" ? "inventory_2" : "chat_bubble"}
          </span>
          <p className="text-slate-300 font-semibold mt-4">
            {tab === "archived" ? "No archived chats" : "No messages yet"}
          </p>
          <p className="text-sm text-slate-500 mt-1 mb-6">
            {tab === "archived"
              ? "Archived conversations will appear here."
              : "Start a direct chat or create a group to message multiple people."}
          </p>
          {tab === "inbox" && (
          <div className="flex flex-col sm:flex-row gap-3 w-full max-w-xs">
            <button
              type="button"
              onClick={() => setShowNewChat(true)}
              className="flex-1 px-6 py-3 rounded-full bg-[#3b82f6] text-white font-semibold hover:bg-[#2563eb] transition-colors"
            >
              New Chat
            </button>
            <button
              type="button"
              onClick={() => setShowNewGroup(true)}
              className="flex-1 px-6 py-3 rounded-full bg-white/10 border border-white/10 text-white font-semibold hover:bg-white/15 transition-colors"
            >
              Create Group
            </button>
          </div>
          )}
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
                  to={chat.type === "group" ? `/group/${chat.id}` : `/chat/${chat.id}`}
                  className="flex items-center gap-4 p-3 rounded-2xl hover:bg-white/5 transition-colors group relative"
                >
                  <div className="relative shrink-0">
                    <div className={`w-14 h-14 ${chat.type === "group" ? "rounded-2xl" : "rounded-full"} bg-slate-800 overflow-hidden shadow-md flex items-center justify-center`}>
                      {chat.type === "group" && !chat.avatar ? (
                        <span className="material-symbols-outlined text-[28px] text-[#3b82f6]">groups</span>
                      ) : (
                        <img
                          src={chat.avatar || `https://api.dicebear.com/9.x/notionists/svg?seed=${chat.name}`}
                          alt={chat.name}
                          className="w-full h-full object-cover"
                        />
                      )}
                    </div>
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-baseline mb-0.5 gap-2">
                      <p className={`font-semibold text-[15px] truncate ${chat.unread > 0 ? "text-white" : "text-slate-200"}`}>
                        {chat.name}
                        {chat.type === "group" && chat.memberCount ? (
                          <span className="text-slate-500 font-normal text-xs ml-1">({chat.memberCount})</span>
                        ) : null}
                      </p>
                      <span className={`text-xs shrink-0 ${chat.unread > 0 ? "text-[#3b82f6] font-semibold" : "text-slate-500"}`}>
                        {chat.updatedAt || ""}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      {chat.unread > 0 && (
                        <span className="material-symbols-outlined text-[16px] text-[#3b82f6] shrink-0">mark_chat_unread</span>
                      )}
                      <p className={`text-[13px] truncate ${chat.unread > 0 ? "text-white font-medium" : "text-slate-400"}`}>
                        {chat.isMuted ? "🔕 " : ""}
                        {chat.lastMessage || "Sent a message"}
                      </p>
                    </div>
                  </div>

                  {chat.unread > 0 && (
                    <div
                      className="shrink-0 min-w-[22px] h-[22px] px-1.5 rounded-full bg-[#3b82f6] text-[11px] font-bold text-white shadow-[0_0_8px_rgba(59,130,246,0.5)] flex items-center justify-center"
                      aria-label={`${chat.unread} unread messages`}
                    >
                      {chat.unread > 99 ? "99+" : chat.unread}
                    </div>
                  )}
                </Link>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}

      <AnimatePresence>
        {showNewChat && (
          <NewConversationSheet
            onClose={() => setShowNewChat(false)}
            onSelectUser={(user) => startChatMutation.mutate(user.id)}
            isStarting={startChatMutation.isPending}
          />
        )}
        {showNewGroup && (
          <NewGroupSheet
            onClose={() => setShowNewGroup(false)}
            onCreateGroup={(payload) => createGroupMutation.mutate(payload)}
            isCreating={createGroupMutation.isPending}
          />
        )}
      </AnimatePresence>

      {isNative && (
        <div className="fixed bottom-[calc(6.25rem+env(safe-area-inset-bottom))] right-4 z-40 flex flex-col gap-2">
          <button
            type="button"
            onClick={() => setShowNewGroup(true)}
            aria-label="Create new group"
            className="w-14 h-14 rounded-full bg-[#3b82f6] text-white shadow-[0_8px_24px_rgba(59,130,246,0.45)] flex items-center justify-center active:scale-95 transition-transform border border-white/10"
          >
            <span className="material-symbols-outlined text-[26px]">groups</span>
          </button>
          <button
            type="button"
            onClick={() => setShowNewChat(true)}
            aria-label="Start new chat"
            className="w-12 h-12 rounded-full bg-[#1a2332] text-white border border-white/10 shadow-lg flex items-center justify-center active:scale-95 transition-transform self-end"
          >
            <span className="material-symbols-outlined text-[22px] text-[#3b82f6]">edit_square</span>
          </button>
        </div>
      )}
    </div>
    </PullToRefresh>
  );
}
