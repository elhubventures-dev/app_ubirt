import { useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "@/lib/AuthContext";
import { useCreatorStudio } from "@/hooks/useCreatorStudio";
import { Card } from "@/components/ui/card";
import { getButtonClasses } from "@/components/ui/PrimaryButton";
import { motion, AnimatePresence } from "framer-motion";
import { useQuery } from "@tanstack/react-query";
import { formatCount } from "@/lib/formatStats";
import { dataProvider } from "@/api/dataProvider";

export default function Profile() {
  const { user } = useAuth();
  const { data: stats, uploads = [], isLoadingUploads } = useCreatorStudio();
  const [activeTab, setActiveTab] = useState("grid"); // 'grid' | 'analytics'
  const { data: achievements } = useQuery({
    queryKey: ["achievements"],
    queryFn: () => dataProvider.getAchievements(),
  });
  const { data: analytics } = useQuery({
    queryKey: ["analytics", user?.id, 28],
    queryFn: () => dataProvider.getCreatorAnalytics(28),
    enabled: activeTab === "analytics",
  });
  const bannerUrl = `https://images.unsplash.com/photo-1557683311-eac922347aa1?w=800&h=300&fit=crop&q=80`;

  return (
    <div className="flex flex-col min-h-full pb-6">
      {/* Dynamic Header */}
      <div className="relative h-48 sm:h-56 rounded-b-[2rem] overflow-hidden shadow-2xl shrink-0 -mx-4 -mt-4">
        <img src={bannerUrl} alt="Cover" className="w-full h-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-t from-[#101822] via-transparent to-transparent opacity-90" />
      </div>

      {/* Profile Info Overlay */}
      <div className="px-4 relative -mt-16 flex flex-col items-center sm:items-start sm:flex-row sm:gap-6 shrink-0">
        <div className="relative">
          <div className="w-28 h-28 rounded-full border-4 border-[#101822] bg-slate-800 overflow-hidden shadow-xl relative z-10">
            <img src={user?.avatar || `https://api.dicebear.com/9.x/notionists/svg?seed=${user?.username || "default"}`} alt={user?.name} className="w-full h-full object-cover" />
          </div>
          {/* Online/Verified Badge */}
          <div className="absolute bottom-2 right-2 w-6 h-6 bg-emerald-500 border-4 border-[#101822] rounded-full z-20" />
        </div>

        <div className="mt-3 sm:mt-16 text-center sm:text-left flex-1">
          <h1 className="text-2xl font-bold tracking-tight text-white">{user?.name || "Creator"}</h1>
          <p className="text-sm font-medium text-[#3b82f6]">@{user?.username || "creator"}</p>
          <p className="mt-2 text-sm text-slate-300 max-w-sm mx-auto sm:mx-0">
            Digital creator & tech enthusiast. Building the future of content on UBIRT. 🚀
          </p>
          
          <div className="mt-4 flex gap-3 justify-center sm:justify-start">
            <Link to="/settings" className={getButtonClasses("secondary", "sm", "rounded-full px-6")}>
              Edit Profile
            </Link>
            <Link to="/create" className={getButtonClasses("primary", "sm", "rounded-full px-6")}>
              Create
            </Link>
            <Link to="/wallet" className="w-9 h-9 flex items-center justify-center rounded-full bg-yellow-500/10 text-yellow-500 border border-yellow-500/20 hover:bg-yellow-500/20 transition-colors shadow-sm">
              <span className="material-symbols-outlined text-[20px]">toll</span>
            </Link>
          </div>
        </div>
      </div>

      {/* Badges Showcase */}
      <div className="mt-6 px-4">
        <Link to="/achievements" className="flex justify-between items-end mb-3 group cursor-pointer">
          <div>
            <h2 className="text-sm font-bold text-white group-hover:text-[#3b82f6] transition-colors">Achievements</h2>
            <p className="text-[10px] text-slate-400 font-medium">
              Level {achievements?.level ?? 1} • {(achievements?.badges ?? []).length} Unlocked
            </p>
          </div>
          <span className="material-symbols-outlined text-[16px] text-slate-500 group-hover:text-[#3b82f6] transition-colors">chevron_right</span>
        </Link>
        <div className="flex gap-3 overflow-x-auto hide-scrollbar pb-2">
           <div className="w-12 h-12 rounded-xl flex items-center justify-center bg-gradient-to-br from-purple-500 to-indigo-500 shadow-lg relative shrink-0">
             <div className="absolute inset-0 bg-white/20 rounded-xl" style={{ clipPath: 'polygon(0 0, 100% 0, 100% 30%, 0 70%)' }} />
             <span className="material-symbols-outlined text-white text-[24px] drop-shadow-md">rocket_launch</span>
           </div>
           <div className="w-12 h-12 rounded-xl flex items-center justify-center bg-gradient-to-br from-orange-500 to-red-500 shadow-lg relative shrink-0">
             <div className="absolute inset-0 bg-white/20 rounded-xl" style={{ clipPath: 'polygon(0 0, 100% 0, 100% 30%, 0 70%)' }} />
             <span className="material-symbols-outlined text-white text-[24px] drop-shadow-md">local_fire_department</span>
           </div>
           <div className="w-12 h-12 rounded-xl flex items-center justify-center bg-gradient-to-br from-blue-400 to-blue-600 shadow-lg relative shrink-0">
             <div className="absolute inset-0 bg-white/20 rounded-xl" style={{ clipPath: 'polygon(0 0, 100% 0, 100% 30%, 0 70%)' }} />
             <span className="material-symbols-outlined text-white text-[24px] drop-shadow-md">forum</span>
           </div>
           
           <Link to="/achievements" className="w-12 h-12 rounded-xl border border-dashed border-white/20 flex items-center justify-center shrink-0 hover:bg-white/5 transition-colors">
             <span className="material-symbols-outlined text-slate-500 text-[20px]">add</span>
           </Link>
        </div>
      </div>

      {/* Tabs */}
      <div className="mt-6 flex justify-center border-b border-white/5 relative shrink-0">
        {["grid", "analytics"].map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`relative px-8 py-3 text-sm font-semibold uppercase tracking-wider transition-colors ${
              activeTab === tab ? "text-white" : "text-slate-500"
            }`}
          >
            {activeTab === tab && (
              <motion.div
                layoutId="profileTabIndicator"
                className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#3b82f6] shadow-[0_0_8px_rgba(59,130,246,0.8)]"
              />
            )}
            {tab}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div className="mt-6 flex-1 min-h-[300px]">
        <AnimatePresence mode="wait">
          {activeTab === "grid" ? (
            <motion.div
              key="grid"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
            >
              {isLoadingUploads ? (
                <p className="text-center text-slate-400 mt-10">Loading grid...</p>
              ) : uploads.length === 0 ? (
                <div className="text-center py-16 px-4 bg-white/5 rounded-3xl border border-white/5 border-dashed">
                  <span className="material-symbols-outlined text-[48px] text-slate-600">grid_view</span>
                  <p className="text-slate-300 mt-4 font-semibold">No posts yet</p>
                  <p className="text-slate-500 text-sm mt-1 mb-4">Create your first piece of content.</p>
                  <Link to="/create" className={getButtonClasses("primary", "sm", "rounded-full")}>Create</Link>
                </div>
              ) : (
                <div className="grid grid-cols-3 gap-1 md:gap-2">
                  {uploads.map((upload) => (
                    <div key={upload.id} className="aspect-[3/4] bg-slate-800 rounded-md sm:rounded-xl overflow-hidden relative group cursor-pointer">
                      {/* Fake thumbnail if no media, else we'd render the media */}
                      <img 
                        src={upload.media_url || `https://api.dicebear.com/9.x/shapes/svg?seed=${upload.id}`} 
                        alt={upload.title || "Upload"} 
                        className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110 opacity-80" 
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex flex-col justify-end p-2 sm:p-3">
                         <p className="text-white text-[10px] sm:text-xs font-semibold truncate">{upload.title}</p>
                         <div className="flex items-center gap-1 mt-1 text-slate-300">
                           <span className="material-symbols-outlined text-[14px]">image</span>
                           <span className="text-[10px] font-medium capitalize">{upload.status ?? "draft"}</span>
                         </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </motion.div>
          ) : (
            <motion.div
              key="analytics"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
              className="space-y-4"
            >
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                <Card className="p-4 bg-white/5 border-white/5 flex flex-col items-center text-center">
                  <span className="material-symbols-outlined text-[#3b82f6] text-[32px] mb-2">group</span>
                  <p className="text-xs text-slate-400 uppercase font-semibold">Followers</p>
                  <p className="text-2xl font-bold mt-1 text-white">{formatCount(stats?.followers ?? 0)}</p>
                </Card>
                <Card className="p-4 bg-white/5 border-white/5 flex flex-col items-center text-center">
                  <span className="material-symbols-outlined text-purple-500 text-[32px] mb-2">visibility</span>
                  <p className="text-xs text-slate-400 uppercase font-semibold">Total Views</p>
                  <p className="text-2xl font-bold mt-1 text-white">{formatCount(stats?.views ?? 0)}</p>
                </Card>
                <Card className="p-4 bg-white/5 border-white/5 flex flex-col items-center text-center col-span-2 sm:col-span-1">
                  <span className="material-symbols-outlined text-emerald-500 text-[32px] mb-2">trending_up</span>
                  <p className="text-xs text-slate-400 uppercase font-semibold">Avg. Completion</p>
                  <p className="text-2xl font-bold mt-1 text-white">{stats?.completionRate ?? 0}%</p>
                </Card>
              </div>

              <Card className="p-5 bg-gradient-to-br from-[#0d5bba]/10 to-transparent border-[#0d5bba]/20 mt-4">
                 <div className="flex justify-between items-center mb-4">
                   <h3 className="font-semibold text-lg">Growth Trajectory</h3>
                   <span className="text-xs px-2 py-1 bg-[#3b82f6]/20 text-[#3b82f6] rounded-full font-bold">
                     {(analytics?.growthPct ?? 0) >= 0 ? "+" : ""}{analytics?.growthPct ?? 0}% this period
                   </span>
                 </div>
                 <div className="h-40 flex items-end justify-between gap-1 sm:gap-2 px-2">
                    {(analytics?.chartData ?? [0, 0, 0, 0, 0, 0, 0]).map((h, i) => (
                      <div key={i} className="w-full bg-[#3b82f6] rounded-t-sm" style={{ height: `${h}%`, opacity: 0.5 + (i * 0.05) }} />
                    ))}
                 </div>
                 <div className="flex justify-between mt-2 text-xs text-slate-500 px-2 font-medium">
                   <span>Mon</span><span>Tue</span><span>Wed</span><span>Thu</span><span>Fri</span><span>Sat</span><span>Sun</span>
                 </div>
              </Card>

              <div className="pt-4 flex justify-center">
                 <Link to="/analytics" className={getButtonClasses("primary", "md", "rounded-full px-8")}>
                    View Detailed Analytics
                 </Link>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
