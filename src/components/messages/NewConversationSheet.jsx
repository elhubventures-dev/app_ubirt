import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { motion } from "framer-motion";
import { useQuery } from "@tanstack/react-query";
import { dataProvider } from "@/api/dataProvider";

export default function NewConversationSheet({ onClose, onSelectUser, isStarting = false }) {
  const [term, setTerm] = useState("");
  const [debouncedTerm, setDebouncedTerm] = useState("");

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedTerm(term.trim()), 300);
    return () => clearTimeout(timer);
  }, [term]);

  const { data: suggested = [], isLoading: isLoadingSuggested } = useQuery({
    queryKey: ["suggested-creators"],
    queryFn: () => dataProvider.getSuggestedCreators(),
    enabled: !debouncedTerm,
  });

  const { data: searchResults, isLoading: isSearching } = useQuery({
    queryKey: ["new-chat-search", debouncedTerm],
    queryFn: () => dataProvider.search(debouncedTerm),
    enabled: debouncedTerm.length > 0,
  });

  const users = debouncedTerm ? (searchResults?.users ?? []) : suggested;
  const isLoading = debouncedTerm ? isSearching : isLoadingSuggested;

  const content = (
    <>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="fixed inset-0 bg-black/60 z-[200] backdrop-blur-sm"
      />
      <motion.div
        initial={{ y: "100%" }}
        animate={{ y: 0 }}
        exit={{ y: "100%" }}
        transition={{ type: "spring", damping: 25, stiffness: 200 }}
        className="fixed bottom-0 left-0 right-0 z-[201] max-h-[80dvh] bg-[#101822] rounded-t-3xl flex flex-col shadow-2xl border-t border-white/10"
      >
        <div className="flex justify-center p-3 shrink-0">
          <div className="w-12 h-1.5 bg-white/20 rounded-full" />
        </div>

        <div className="px-4 pb-3 flex justify-between items-center border-b border-white/5 shrink-0">
          <h3 className="font-semibold text-lg">New Message</h3>
          <button type="button" onClick={onClose} className="text-slate-400 p-1 hover:text-white rounded-full bg-white/5">
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        <div className="px-4 py-3 shrink-0">
          <div className="flex items-center gap-2 bg-white/5 border border-white/10 rounded-2xl px-3 py-2.5">
            <span className="material-symbols-outlined text-slate-400 text-[20px]">search</span>
            <input
              value={term}
              onChange={(e) => setTerm(e.target.value)}
              placeholder="Search by name or username..."
              className="flex-1 bg-transparent text-white text-sm placeholder:text-slate-500 focus:outline-none"
              autoFocus
            />
          </div>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto px-2 pb-[calc(1rem+env(safe-area-inset-bottom))]">
          <p className="px-2 py-2 text-xs font-semibold text-slate-500 uppercase tracking-wider">
            {debouncedTerm ? "Search results" : "Suggested creators"}
          </p>

          {isLoading ? (
            <p className="text-center text-slate-400 py-8 text-sm">Loading...</p>
          ) : users.length === 0 ? (
            <p className="text-center text-slate-400 py-8 text-sm">No users found.</p>
          ) : (
            <div className="space-y-1">
              {users.map((user) => (
                <button
                  key={user.id}
                  type="button"
                  disabled={isStarting}
                  onClick={() => onSelectUser(user)}
                  className="w-full flex items-center gap-3 p-3 rounded-2xl hover:bg-white/5 transition-colors disabled:opacity-60"
                >
                  <div className="w-12 h-12 rounded-full bg-slate-800 overflow-hidden shrink-0">
                    <img
                      src={user.avatar || `https://api.dicebear.com/9.x/notionists/svg?seed=${user.username}`}
                      alt=""
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <div className="flex-1 min-w-0 text-left">
                    <p className="font-semibold text-white truncate">{user.name}</p>
                    <p className="text-sm text-slate-400 truncate">@{user.username}</p>
                  </div>
                  <span className="material-symbols-outlined text-[#3b82f6]">chat</span>
                </button>
              ))}
            </div>
          )}
        </div>
      </motion.div>
    </>
  );

  return createPortal(content, document.body);
}
