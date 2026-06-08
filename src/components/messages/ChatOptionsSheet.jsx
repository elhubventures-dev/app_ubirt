import { motion } from "framer-motion";
import { CHAT_THEMES } from "@/lib/chatThemes";

export default function ChatOptionsSheet({
  conversation,
  onClose,
  onSearch,
  onMute,
  onArchive,
  onThemeChange,
  showArchived = false,
}) {
  const themes = Object.values(CHAT_THEMES);
  const isMuted = conversation?.isMuted;

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
        className="fixed bottom-0 left-0 right-0 z-[301] max-h-[80dvh] bg-[#101822] rounded-t-3xl border-t border-white/10 flex flex-col shadow-2xl"
      >
        <div className="w-12 h-1.5 bg-white/20 rounded-full mx-auto my-3 shrink-0" />
        <h3 className="px-6 font-semibold text-lg text-white mb-3">Chat options</h3>

        <div className="flex-1 overflow-y-auto px-4 pb-[calc(1rem+env(safe-area-inset-bottom))] space-y-4">
          <button
            type="button"
            onClick={() => {
              onSearch?.();
              onClose();
            }}
            className="w-full flex items-center gap-3 p-3 rounded-2xl bg-white/5 hover:bg-white/10 transition-colors text-left"
          >
            <span className="material-symbols-outlined text-[#3b82f6]">search</span>
            <span className="text-sm font-semibold text-white">Search messages</span>
          </button>

          <div>
            <p className="text-xs text-slate-500 uppercase tracking-wider px-1 mb-2">Mute notifications</p>
            <div className="grid grid-cols-2 gap-2">
              {[
                { label: "1 hour", hours: 1 },
                { label: "8 hours", hours: 8 },
                { label: "1 week", hours: 24 * 7 },
                { label: isMuted ? "Unmute" : "Forever", hours: isMuted ? 0 : 24 * 365 * 10 },
              ].map((opt) => (
                <button
                  key={opt.label}
                  type="button"
                  onClick={() => onMute?.(opt.hours)}
                  className="px-3 py-2.5 rounded-xl bg-white/5 border border-white/10 text-sm font-medium text-slate-200 hover:bg-white/10"
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          <button
            type="button"
            onClick={() => onArchive?.(!showArchived)}
            className="w-full flex items-center gap-3 p-3 rounded-2xl bg-white/5 hover:bg-white/10 transition-colors text-left"
          >
            <span className="material-symbols-outlined text-amber-400">
              {showArchived ? "unarchive" : "inventory_2"}
            </span>
            <span className="text-sm font-semibold text-white">
              {showArchived ? "Move to inbox" : "Archive chat"}
            </span>
          </button>

          <div>
            <p className="text-xs text-slate-500 uppercase tracking-wider px-1 mb-2">Chat theme</p>
            <div className="grid grid-cols-2 gap-2">
              {themes.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => onThemeChange?.(t.id)}
                  className={`px-3 py-2.5 rounded-xl border text-sm font-medium transition-colors ${
                    conversation?.chatTheme === t.id
                      ? "border-[#3b82f6] bg-[#3b82f6]/15 text-white"
                      : "border-white/10 bg-white/5 text-slate-200 hover:bg-white/10"
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </motion.div>
    </>
  );
}
