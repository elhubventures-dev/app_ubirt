import { useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";

const BADGES = [
  { id: 1, title: "Early Adopter", description: "Joined during beta.", icon: "rocket_launch", color: "from-purple-500 to-indigo-500", unlocked: true },
  { id: 2, title: "Top 1% Creator", description: "Reached 100k views.", icon: "local_fire_department", color: "from-orange-500 to-red-500", unlocked: true },
  { id: 3, title: "Social Butterfly", description: "Left 50 comments.", icon: "forum", color: "from-blue-400 to-blue-600", unlocked: true },
  { id: 4, title: "Trendsetter", description: "A post reached #1 trending.", icon: "trending_up", color: "from-emerald-400 to-emerald-600", unlocked: false },
  { id: 5, title: "Live Legend", description: "Hosted 10 live streams.", icon: "podcasts", color: "from-pink-500 to-rose-500", unlocked: false },
  { id: 6, title: "Diamond Status", description: "Received 1,000 gifts.", icon: "diamond", color: "from-cyan-300 to-blue-500", unlocked: false },
];

import { useQuery } from "@tanstack/react-query";
import { dataProvider } from "@/api/dataProvider";

export default function Achievements() {
  const [activeTab, setActiveTab] = useState("badges");
  
  const { data, isLoading } = useQuery({
    queryKey: ["achievements"],
    queryFn: () => dataProvider.getAchievements(),
  });

  const level = data?.level || 1;
  const xp = data?.xp || 0;
  const xpNeeded = data?.xpForNextLevel ?? level * level * 100;
  const progress = data?.xpProgress ?? 0;
  const quests = data?.quests ?? [];
  
  const unlockedBadges = new Set(data?.badges || []);
  const displayBadges = BADGES.map(b => ({
    ...b,
    unlocked: unlockedBadges.has(String(b.id)) || unlockedBadges.has(b.id),
  }));

  return (
    <div className="flex flex-col h-[100dvh] bg-[#0a0f16] text-white overflow-hidden relative">
      {/* Background aesthetics */}
      <div className="absolute top-[-10%] right-[-10%] w-[50%] h-[40%] bg-purple-600/10 blur-[120px] rounded-full pointer-events-none z-0" />
      <div className="absolute bottom-[-10%] left-[-10%] w-[60%] h-[50%] bg-blue-600/10 blur-[120px] rounded-full pointer-events-none z-0" />

      {/* Header */}
      <header className="shrink-0 px-4 py-4 bg-[#101822]/80 backdrop-blur-xl border-b border-white/5 flex items-center justify-between z-10 shadow-sm relative">
        <Link to="/profile" className="text-[#3b82f6] flex items-center gap-1 hover:bg-white/5 rounded-full p-1.5 -ml-1.5 transition-colors">
          <span className="material-symbols-outlined text-[24px]">arrow_back_ios</span>
        </Link>
        <h1 className="text-base font-bold tracking-wide absolute left-1/2 -translate-x-1/2">Achievements</h1>
        <div className="w-8" />
      </header>

      {/* Scrollable Content */}
      <div className="flex-1 overflow-y-auto hide-scrollbar relative z-10">
        <div className="px-4 py-6 max-w-lg mx-auto space-y-8">
          
          {/* Level Progress Header */}
          <section className="bg-white/5 border border-white/10 p-6 rounded-3xl backdrop-blur-sm text-center relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-yellow-500/10 blur-3xl rounded-full pointer-events-none" />
            <h2 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4">Creator Level</h2>
            
            <div className="relative w-32 h-32 mx-auto flex items-center justify-center">
              <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
                <circle cx="50" cy="50" r="45" fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="6" />
                <motion.circle 
                  cx="50" cy="50" r="45" fill="none" 
                  stroke="url(#gradient)" strokeWidth="6" 
                  strokeLinecap="round"
                  strokeDasharray="283"
                  initial={{ strokeDashoffset: 283 }}
                  animate={{ strokeDashoffset: 283 - (283 * progress) / 100 }}
                  transition={{ duration: 1.5, ease: "easeOut" }}
                />
                <defs>
                  <linearGradient id="gradient" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#8b5cf6" />
                    <stop offset="100%" stopColor="#3b82f6" />
                  </linearGradient>
                </defs>
              </svg>
              <div className="absolute flex flex-col items-center">
                <span className="text-4xl font-black bg-clip-text text-transparent bg-gradient-to-br from-purple-400 to-blue-400 drop-shadow-sm">{level}</span>
              </div>
            </div>
            
            <div className="mt-5">
               <p className="text-sm font-semibold text-white">{xp} / {xpNeeded} XP</p>
               <p className="text-xs text-slate-400 mt-1">Keep creating to reach Level {level + 1}!</p>
            </div>
          </section>

          {/* Tabs */}
          <div className="flex bg-white/5 p-1 rounded-2xl border border-white/5">
             <button onClick={() => setActiveTab("badges")} className={`flex-1 py-2 text-sm font-bold rounded-xl transition-all ${activeTab === "badges" ? "bg-white/10 text-white shadow-sm" : "text-slate-400 hover:text-white"}`}>Badges</button>
             <button onClick={() => setActiveTab("quests")} className={`flex-1 py-2 text-sm font-bold rounded-xl transition-all ${activeTab === "quests" ? "bg-white/10 text-white shadow-sm" : "text-slate-400 hover:text-white"}`}>Daily Quests</button>
          </div>

          {/* Badges Gallery */}
          {activeTab === "badges" && (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="grid grid-cols-2 gap-4">
              {isLoading ? <p className="text-center text-slate-400 mt-10 col-span-2">Loading...</p> : displayBadges.map((badge, i) => (
                <motion.div 
                  key={badge.id} 
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: i * 0.1 }}
                  whileHover={badge.unlocked ? { scale: 1.05, y: -5 } : {}}
                  className={`relative p-5 rounded-3xl border flex flex-col items-center text-center overflow-hidden group ${
                    badge.unlocked 
                      ? "bg-white/5 border-white/10 cursor-pointer" 
                      : "bg-white/5 border-white/5 opacity-60 grayscale"
                  }`}
                >
                  {badge.unlocked && (
                    <div className="absolute inset-0 bg-gradient-to-br from-white/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                  )}
                  {/* Glossy Badge Icon */}
                  <div className={`w-16 h-16 rounded-2xl mb-3 flex items-center justify-center bg-gradient-to-br ${badge.color} shadow-lg relative`}>
                     <div className="absolute inset-0 bg-white/20 rounded-2xl" style={{ clipPath: 'polygon(0 0, 100% 0, 100% 30%, 0 70%)' }} />
                     <span className="material-symbols-outlined text-white text-[32px] drop-shadow-md">{badge.icon}</span>
                  </div>
                  <h3 className="font-bold text-sm text-white mb-1">{badge.title}</h3>
                  <p className="text-[10px] text-slate-400 leading-tight">{badge.description}</p>
                </motion.div>
              ))}
            </motion.div>
          )}

          {/* Daily Quests */}
          {activeTab === "quests" && (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-3">
               {quests.map((quest, i) => (
                 <motion.div 
                   key={quest.id}
                   initial={{ opacity: 0, x: -20 }}
                   animate={{ opacity: 1, x: 0 }}
                   transition={{ delay: i * 0.1 }}
                   className="bg-white/5 border border-white/10 p-5 rounded-3xl relative overflow-hidden"
                 >
                    {quest.completed && (
                       <div className="absolute top-0 right-0 w-16 h-16 bg-emerald-500/20 blur-xl rounded-full" />
                    )}
                    <div className="flex justify-between items-start mb-3">
                       <div>
                         <h3 className={`font-bold text-sm ${quest.completed ? "text-emerald-400" : "text-white"}`}>{quest.title}</h3>
                         <p className="text-xs text-slate-400 mt-0.5 flex items-center gap-1">
                           <span className="material-symbols-outlined text-[14px] text-yellow-500">stars</span>
                           +{quest.reward} XP
                         </p>
                       </div>
                       {quest.completed ? (
                         <div className="w-8 h-8 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0">
                           <span className="material-symbols-outlined text-[18px]">check</span>
                         </div>
                       ) : (
                         <div className="text-xs font-bold text-slate-400">{quest.progress} / {quest.total}</div>
                       )}
                    </div>
                    {/* Progress Bar */}
                    <div className="h-2 w-full bg-black/50 rounded-full overflow-hidden">
                       <motion.div 
                         initial={{ width: 0 }}
                         animate={{ width: `${(quest.progress / quest.total) * 100}%` }}
                         transition={{ duration: 1, delay: 0.5 + (i * 0.1) }}
                         className={`h-full rounded-full ${quest.completed ? "bg-emerald-500" : "bg-[#3b82f6]"}`} 
                       />
                    </div>
                 </motion.div>
               ))}
            </motion.div>
          )}

          <div className="h-10" />
        </div>
      </div>
    </div>
  );
}
