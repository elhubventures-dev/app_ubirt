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
  const { data: items = [], isLoading } = useNotifications();

  // Sort or group items if needed, but we'll assume they come ordered by time
  return (
    <div className="flex flex-col min-h-full pb-20 pt-4 px-2 sm:px-4 overflow-hidden relative">
      {/* Background aesthetics */}
      <div className="absolute inset-0 pointer-events-none bg-[#101822] z-0" />
      <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[40%] bg-[#3b82f6]/5 blur-[120px] rounded-full z-0 pointer-events-none" />

      <div className="relative z-10">
        <div className="flex items-center justify-between px-2 mb-6">
          <h1 className="text-2xl font-bold text-white tracking-tight">Inbox</h1>
          <button className="text-slate-400 text-sm font-medium hover:text-white transition-colors">
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
                  <motion.div
                    key={item.id}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.05 }}
                    className="flex gap-4 p-4 rounded-2xl bg-white/5 border border-transparent hover:border-white/5 hover:bg-white/10 transition-colors relative overflow-hidden group"
                  >
                    {/* Unread dot indicator (mock logic) */}
                    {i < 2 && <div className="absolute top-1/2 -translate-y-1/2 left-1.5 w-1.5 h-1.5 bg-[#3b82f6] rounded-full shadow-[0_0_6px_rgba(59,130,246,0.8)]" />}

                    {/* Icon / Avatar Area */}
                    <div className="relative shrink-0 ml-2">
                       {item.type === "system" ? (
                          <div className="w-12 h-12 rounded-full bg-slate-800 flex items-center justify-center">
                             <img src="https://images.unsplash.com/photo-1545239351-1141bd82e8a6?w=48&h=48&fit=crop" className="w-full h-full object-cover rounded-full opacity-80" alt="UBIRT" />
                          </div>
                       ) : (
                          <div className="w-12 h-12 rounded-full bg-slate-800 overflow-hidden">
                            <img src={`https://api.dicebear.com/9.x/notionists/svg?seed=${item.id}`} className="w-full h-full object-cover" />
                          </div>
                       )}
                       <div className={`absolute -bottom-1 -right-1 w-6 h-6 rounded-full ${config.bg} flex items-center justify-center border-2 border-[#151c27]`}>
                         <span className={`material-symbols-outlined text-[12px] fill-1 ${config.color}`}>{config.icon}</span>
                       </div>
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0 flex flex-col justify-center">
                       <p className="text-[14px] text-slate-200 leading-snug">
                         {item.type !== "system" && <span className="font-bold text-white mr-1">User{item.id.slice(0,3)}</span>}
                         {item.text}
                       </p>
                       <p className="text-xs text-slate-500 mt-1 font-medium">{item.time || "2 hours ago"}</p>
                       
                       {/* Inline Actions based on type */}
                       {item.type.toLowerCase() === "follow" && (
                         <div className="mt-2.5">
                           <button className="px-4 py-1.5 bg-[#3b82f6] text-white text-xs font-semibold rounded-full hover:bg-[#2563eb] transition-colors">Follow Back</button>
                         </div>
                       )}
                       {item.type.toLowerCase() === "comment" && (
                         <div className="mt-2.5">
                           <button className="px-4 py-1.5 bg-white/10 text-white text-xs font-semibold rounded-full hover:bg-white/20 transition-colors">Reply</button>
                         </div>
                       )}
                    </div>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>
        )}
      </div>
    </div>
  );
}
