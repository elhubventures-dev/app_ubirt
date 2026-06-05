import { useNotifications } from "@/hooks/useNotifications";
import { SkeletonRow } from "@/components/ui/SkeletonRow";
import { motion, AnimatePresence } from "framer-motion";

const iconMap = {
  like: { icon: "favorite", color: "text-red-500", bg: "bg-red-500/10" },
  comment: { icon: "chat_bubble", color: "text-[#3b82f6]", bg: "bg-[#3b82f6]/10" },
  follow: { icon: "person_add", color: "text-emerald-500", bg: "bg-emerald-500/10" },
  system: { icon: "campaign", color: "text-purple-500", bg: "bg-purple-500/10" },
};

export default function Notifications() {
  const { data: items = [], isLoading, markAllRead, markRead, isMarkingRead } = useNotifications();
  const unreadCount = items.filter((item) => !item.read).length;

  const onMarkAllRead = async () => {
    if (!unreadCount) return;
    await markAllRead();
  };

  const onItemClick = async (item) => {
    if (!item.read) await markRead(item.id);
  };

  return (
    <div className="flex flex-col min-h-full pb-20 pt-4 px-2 sm:px-4 overflow-hidden relative">
      <div className="absolute inset-0 pointer-events-none bg-[#101822] z-0" />
      <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[40%] bg-[#3b82f6]/5 blur-[120px] rounded-full z-0 pointer-events-none" />

      <div className="relative z-10">
        <div className="flex items-center justify-between px-2 mb-6">
          <h1 className="text-2xl font-bold text-white tracking-tight">
            Inbox
            {unreadCount > 0 && (
              <span className="ml-2 text-sm font-semibold text-[#3b82f6]">{unreadCount} new</span>
            )}
          </h1>
          <button
            type="button"
            disabled={!unreadCount || isMarkingRead}
            onClick={onMarkAllRead}
            className="text-slate-400 text-sm font-medium hover:text-white transition-colors disabled:opacity-40"
          >
            Mark all read
          </button>
        </div>

        {isLoading ? (
          <div className="space-y-4 px-2" aria-label="Loading notifications">
            <SkeletonRow height="lg" count={5} />
          </div>
        ) : !items.length ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="w-20 h-20 bg-white/5 rounded-full flex items-center justify-center mb-4">
               <span className="material-symbols-outlined text-[40px] text-slate-600">notifications_off</span>
            </div>
            <p className="text-slate-300 font-semibold">All caught up!</p>
            <p className="text-sm text-slate-500 mt-1">Check back later for new notifications.</p>
          </div>
        ) : (
          <div className="space-y-1.5">
            <AnimatePresence>
              {items.map((item, i) => {
                const config = iconMap[item.type.toLowerCase()] || iconMap.system;
                return (
                  <motion.button
                    type="button"
                    key={item.id}
                    onClick={() => onItemClick(item)}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.05 }}
                    className={`w-full text-left flex gap-4 p-4 rounded-2xl border transition-colors relative overflow-hidden group ${
                      item.read
                        ? "bg-white/[0.03] border-transparent hover:bg-white/5"
                        : "bg-white/5 border-white/5 hover:border-white/10 hover:bg-white/10"
                    }`}
                  >
                    {!item.read && (
                      <div className="absolute top-1/2 -translate-y-1/2 left-1.5 w-1.5 h-1.5 bg-[#3b82f6] rounded-full shadow-[0_0_6px_rgba(59,130,246,0.8)]" />
                    )}

                    <div className="relative shrink-0 ml-2">
                       {item.type === "system" ? (
                          <div className="w-12 h-12 rounded-full bg-slate-800 flex items-center justify-center">
                             <img src="/pwa-192x192.png" className="w-full h-full object-contain rounded-full" alt="UBIRT" />
                          </div>
                       ) : (
                          <div className="w-12 h-12 rounded-full bg-slate-800 overflow-hidden">
                            <img src={`https://api.dicebear.com/9.x/notionists/svg?seed=${item.id}`} className="w-full h-full object-cover" alt="" />
                          </div>
                       )}
                       <div className={`absolute -bottom-1 -right-1 w-6 h-6 rounded-full ${config.bg} flex items-center justify-center border-2 border-[#151c27]`}>
                         <span className={`material-symbols-outlined text-[12px] fill-1 ${config.color}`}>{config.icon}</span>
                       </div>
                    </div>

                    <div className="flex-1 min-w-0 flex flex-col justify-center">
                       <p className={`text-[14px] leading-snug ${item.read ? "text-slate-400" : "text-slate-200"}`}>
                         {item.text}
                       </p>
                       <p className="text-xs text-slate-500 mt-1 font-medium">{item.time || "2 hours ago"}</p>
                    </div>
                  </motion.button>
                );
              })}
            </AnimatePresence>
          </div>
        )}
      </div>
    </div>
  );
}
