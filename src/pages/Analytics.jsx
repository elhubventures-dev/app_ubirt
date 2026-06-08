import { useState } from "react";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/lib/AuthContext";
import { Card } from "@/components/ui/card";
import { dataProvider } from "@/api/dataProvider";
import { useQuery } from "@tanstack/react-query";

const RANGES = [
  { label: "7 Days", days: 7 },
  { label: "28 Days", days: 28 },
  { label: "90 Days", days: 90 },
  { label: "All Time", days: 365 },
];

export default function Analytics() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [days, setDays] = useState(28);

  const { data: stats, isLoading } = useQuery({
    queryKey: ["analytics", user?.id, days],
    queryFn: () => dataProvider.getCreatorAnalytics(days),
  });

  const growthLabel =
    (stats?.growthPct ?? 0) >= 0
      ? `+${stats?.growthPct ?? 0}% this period`
      : `${stats?.growthPct ?? 0}% this period`;

  return (
    <div className="min-h-screen bg-[#101822] text-white flex flex-col relative overflow-hidden">
      <div className="absolute inset-0 pointer-events-none bg-gradient-to-br from-[#0d5bba]/10 via-[#101822] to-[#152336] z-0" />

      <header className="relative z-10 px-4 py-4 flex items-center border-b border-white/5 bg-[#101822]/50 backdrop-blur-md">
        <button type="button" onClick={() => navigate(-1)} className="text-slate-400 p-2 hover:text-white rounded-full bg-white/5 transition-colors mr-4">
          <span className="material-symbols-outlined">arrow_back</span>
        </button>
        <h1 className="text-xl font-bold flex-1 text-center pr-10">Creator Analytics</h1>
      </header>

      <main className="flex-1 relative z-10 p-4 max-w-md mx-auto w-full flex flex-col gap-6 pb-10">
        <div className="flex justify-between items-center bg-white/5 rounded-full p-1">
          {RANGES.map((range) => (
            <button
              key={range.label}
              type="button"
              onClick={() => setDays(range.days)}
              className={`flex-1 py-1.5 text-xs font-bold rounded-full transition-colors ${
                days === range.days ? "bg-white text-black shadow-md" : "text-slate-400 hover:text-white"
              }`}
            >
              {range.label}
            </button>
          ))}
        </div>

        {isLoading ? (
          <p className="text-center text-slate-400 mt-10">Loading analytics...</p>
        ) : (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-6"
          >
            <div className="grid grid-cols-2 gap-3">
              <Card className="p-4 bg-white/5 border-white/5 flex flex-col items-center text-center">
                <span className="material-symbols-outlined text-[#3b82f6] text-[32px] mb-2">group</span>
                <p className="text-xs text-slate-400 uppercase font-semibold">Followers</p>
                <p className="text-2xl font-bold mt-1 text-white">{stats?.followers?.toLocaleString() || "0"}</p>
              </Card>
              <Card className="p-4 bg-white/5 border-white/5 flex flex-col items-center text-center">
                <span className="material-symbols-outlined text-purple-500 text-[32px] mb-2">visibility</span>
                <p className="text-xs text-slate-400 uppercase font-semibold">Total Views</p>
                <p className="text-2xl font-bold mt-1 text-white">{stats?.views?.toLocaleString() || "0"}</p>
              </Card>
              <Card className="p-4 bg-white/5 border-white/5 flex flex-col items-center text-center">
                <span className="material-symbols-outlined text-emerald-500 text-[32px] mb-2">trending_up</span>
                <p className="text-xs text-slate-400 uppercase font-semibold">Avg. Completion</p>
                <p className="text-2xl font-bold mt-1 text-white">{stats?.completionRate || "0"}%</p>
              </Card>
              <Card className="p-4 bg-white/5 border-white/5 flex flex-col items-center text-center">
                <span className="material-symbols-outlined text-amber-500 text-[32px] mb-2">monetization_on</span>
                <p className="text-xs text-slate-400 uppercase font-semibold">Coins Earned</p>
                <p className="text-2xl font-bold mt-1 text-white">{stats?.earnings || "0"}</p>
              </Card>
            </div>

            <Card className="p-5 bg-gradient-to-br from-[#0d5bba]/10 to-transparent border-[#0d5bba]/20 mt-4">
               <div className="flex justify-between items-center mb-4">
                 <h3 className="font-semibold text-lg">Growth Trajectory</h3>
                 <span className="text-xs px-2 py-1 bg-[#3b82f6]/20 text-[#3b82f6] rounded-full font-bold">{growthLabel}</span>
               </div>
               <div className="h-40 flex items-end justify-between gap-1 sm:gap-2 px-2">
                  {(stats?.chartData || [0, 0, 0, 0, 0, 0, 0]).map((h, i) => (
                    <div key={i} className="w-full bg-[#3b82f6] rounded-t-sm" style={{ height: `${h}%`, opacity: 0.5 + (i * 0.05) }} />
                  ))}
               </div>
               <div className="flex justify-between mt-2 text-xs text-slate-500 px-2 font-medium">
                 <span>Mon</span><span>Tue</span><span>Wed</span><span>Thu</span><span>Fri</span><span>Sat</span><span>Sun</span>
               </div>
            </Card>
          </motion.div>
        )}
      </main>
    </div>
  );
}
