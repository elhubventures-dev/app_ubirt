import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useFeed } from "@/hooks/useFeed";
import { useConversations } from "@/hooks/useMessages";
import { useNotifications } from "@/hooks/useNotifications";
import { Card } from "@/components/ui/card";
import { InputField } from "@/components/ui/InputField";
import { motion, AnimatePresence } from "framer-motion";

const TRENDING_TAGS = ["#Tech", "#Vlog", "#Tutorial", "#Lifestyle", "#Comedy", "#Music"];

export default function Search() {
  const [term, setTerm] = useState("");
  const [activeTab, setActiveTab] = useState("top"); // 'top' | 'users' | 'videos' | 'sounds'
  const [showFilters, setShowFilters] = useState(false);
  const { data: posts = [] } = useFeed();
  const { data: chats = [] } = useConversations();
  const { data: notifications = [] } = useNotifications();

  const results = useMemo(() => {
    const query = term.trim().toLowerCase();
    if (!query) return { top: [], users: [], videos: [], sounds: [] };

    const postResults = posts
      .filter((p) => `${p.author} ${p.caption}`.toLowerCase().includes(query))
      .map((p) => ({ id: p.id, type: "video", title: p.author, subtitle: p.caption, ...p }));
      
    const creatorResults = chats
      .filter((c) => `${c.name}`.toLowerCase().includes(query))
      .map((c) => ({ id: c.id, type: "user", title: c.name, subtitle: "Content Creator" }));

    const soundResults = [
      { id: "s1", type: "sound", title: "Original Sound", subtitle: query },
      { id: "s2", type: "sound", title: "Trending Beat", subtitle: query },
    ];

    return {
      top: [...creatorResults, ...postResults, ...soundResults].slice(0, 5),
      users: creatorResults,
      videos: postResults,
      sounds: soundResults
    };
  }, [term, posts, chats]);

  const activeResults = results[activeTab];

  return (
    <div className="flex flex-col min-h-full pb-20 pt-2 px-4 relative overflow-hidden">
      {/* Background aesthetics */}
      <div className="absolute inset-0 pointer-events-none bg-gradient-to-tr from-[#0a111a] via-[#101822] to-[#152336] z-0" />

      <div className="relative z-10">
        <h1 className="text-2xl font-bold text-white mb-4">Discover</h1>

        {/* Search Input */}
        <div className="relative group">
          <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none">
            <span className="material-symbols-outlined text-slate-400 group-focus-within:text-[#3b82f6] transition-colors">search</span>
          </div>
          <input
            type="text"
            value={term}
            onChange={(e) => setTerm(e.target.value)}
            placeholder="Search creators, posts, tags..."
            className="w-full bg-[#1a2332]/80 backdrop-blur-md border border-white/10 rounded-full py-3.5 pl-12 pr-4 text-white placeholder-slate-400 focus:outline-none focus:border-[#3b82f6]/50 focus:ring-1 focus:ring-[#3b82f6]/50 transition-all shadow-inner"
          />
          {term && (
            <button onClick={() => setTerm("")} className="absolute inset-y-0 right-12 flex items-center text-slate-400 hover:text-white">
              <span className="material-symbols-outlined text-[20px]">close</span>
            </button>
          )}
          <button 
            onClick={() => setShowFilters(!showFilters)}
            className={`absolute inset-y-0 right-2 flex items-center p-2 rounded-full transition-colors ${showFilters ? 'text-[#3b82f6] bg-[#3b82f6]/10' : 'text-slate-400 hover:text-white'}`}
          >
            <span className="material-symbols-outlined text-[20px]">tune</span>
          </button>
        </div>

        {/* Filters Panel */}
        <AnimatePresence>
          {showFilters && (
            <motion.div 
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden mt-3"
            >
              <div className="bg-[#1a2332]/80 backdrop-blur-md rounded-2xl p-4 border border-white/10 flex flex-col gap-3 text-sm">
                <div className="flex justify-between items-center">
                   <span className="font-semibold text-slate-300">Date Posted</span>
                   <select className="bg-white/5 border border-white/10 rounded-lg px-2 py-1 outline-none">
                     <option>Any time</option><option>Today</option><option>This Week</option><option>This Month</option>
                   </select>
                </div>
                <div className="flex justify-between items-center">
                   <span className="font-semibold text-slate-300">Popularity</span>
                   <select className="bg-white/5 border border-white/10 rounded-lg px-2 py-1 outline-none">
                     <option>Most Relevant</option><option>Most Liked</option><option>Most Viewed</option>
                   </select>
                </div>
                <div className="flex justify-between items-center">
                   <span className="font-semibold text-slate-300">Length</span>
                   <select className="bg-white/5 border border-white/10 rounded-lg px-2 py-1 outline-none">
                     <option>Any length</option><option>Under 1 min</option><option>1 - 3 mins</option><option>Over 3 mins</option>
                   </select>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Trending Pills */}
        {!term && (
          <div className="mt-6">
            <h2 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3 px-1">Trending Tags</h2>
            <div className="flex gap-2 overflow-x-auto hide-scrollbar pb-2 -mx-4 px-4">
              {TRENDING_TAGS.map((tag) => (
                <Link key={tag} to={`/tag/${tag.replace('#', '')}`} className="shrink-0 bg-white/5 hover:bg-[#3b82f6]/20 border border-white/10 hover:border-[#3b82f6]/30 px-4 py-2 rounded-full text-sm font-medium text-slate-300 hover:text-[#3b82f6] transition-colors whitespace-nowrap flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-[16px]">trending_up</span> {tag}
                </Link>
              ))}
            </div>
            
            {/* Suggested Creators Mock */}
            <div className="mt-8">
               <h2 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3 px-1">Suggested Creators</h2>
               <div className="grid grid-cols-2 gap-3">
                 {[1,2,3,4].map(i => (
                   <Link key={i} to={`/user/Creator${i}`} className="bg-white/5 border border-white/10 p-3 rounded-2xl flex items-center gap-3 hover:bg-white/10 transition-colors">
                      <div className="w-10 h-10 rounded-full bg-slate-800 overflow-hidden shrink-0">
                        <img src={`https://api.dicebear.com/9.x/notionists/svg?seed=Creator${i}`} className="w-full h-full object-cover" />
                      </div>
                      <div className="min-w-0">
                         <p className="font-semibold text-sm text-white truncate">Creator {i}</p>
                         <p className="text-xs text-slate-400 truncate">Follow</p>
                      </div>
                   </Link>
                 ))}
               </div>
            </div>
          </div>
        )}

        {/* Results */}
        {term && (
          <div className="mt-6">
            {/* Tabs */}
            <div className="flex gap-4 border-b border-white/10 mb-4 pb-0.5 overflow-x-auto hide-scrollbar">
              {["top", "users", "videos", "sounds"].map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`py-2 text-sm font-semibold capitalize relative transition-colors whitespace-nowrap ${activeTab === tab ? "text-[#3b82f6]" : "text-slate-400 hover:text-slate-200"}`}
                >
                  {tab}
                  {activeTab === tab && (
                    <motion.div layoutId="searchTabIndicator" className="absolute bottom-[-1px] left-0 right-0 h-0.5 bg-[#3b82f6]" />
                  )}
                </button>
              ))}
            </div>

            <div className="space-y-3">
              <AnimatePresence mode="popLayout">
                {activeResults.length === 0 ? (
                  <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center py-10">
                    <span className="material-symbols-outlined text-[48px] text-slate-600">search_off</span>
                    <p className="text-slate-400 mt-2">No results found for "{term}"</p>
                  </motion.div>
                ) : (
                  activeResults.map((result) => (
                    <motion.div
                      layout
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.95 }}
                      key={`${result.type}-${result.id}`}
                    >
                      {result.type === "user" ? (
                        <Link to={`/user/${result.title}`} className="bg-white/5 border border-white/5 p-3 rounded-2xl flex items-center gap-3">
                          <div className="w-12 h-12 rounded-full bg-slate-800 overflow-hidden shrink-0">
                             <img src={`https://api.dicebear.com/9.x/notionists/svg?seed=${result.title}`} className="w-full h-full object-cover" />
                          </div>
                          <div className="flex-1 min-w-0">
                             <p className="font-semibold text-white truncate">{result.title}</p>
                             <p className="text-xs text-slate-400 truncate">@{result.title.toLowerCase().replace(/\s/g, '')}</p>
                          </div>
                          <button className="px-4 py-1.5 bg-[#3b82f6]/10 text-[#3b82f6] font-semibold text-xs rounded-full">Follow</button>
                        </Link>
                      ) : result.type === "sound" ? (
                        <div className="bg-white/5 border border-white/5 p-3 rounded-2xl flex items-center gap-3 group cursor-pointer hover:bg-white/10 transition-colors">
                           <div className="w-12 h-12 bg-gradient-to-br from-[#3b82f6] to-purple-500 rounded-lg flex items-center justify-center shrink-0 shadow-inner">
                             <span className="material-symbols-outlined text-white">music_note</span>
                           </div>
                           <div className="flex-1 min-w-0">
                              <p className="font-semibold text-white text-sm truncate">{result.title}</p>
                              <p className="text-[10px] text-slate-400 font-medium truncate">{result.subtitle}</p>
                           </div>
                           <button className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center text-white hover:bg-white/20 transition-colors">
                             <span className="material-symbols-outlined text-[18px] ml-0.5">play_arrow</span>
                           </button>
                        </div>
                      ) : (
                        <Link to="/feed" className="bg-white/5 border border-white/5 p-3 rounded-2xl flex gap-3 group">
                           <div className="w-16 h-20 bg-slate-800 rounded-lg overflow-hidden shrink-0 relative">
                             <img src={`https://images.unsplash.com/photo-1616469829581-73993eb86b02?w=150&h=200&fit=crop&q=80&seed=${result.id}`} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500 opacity-80" />
                           </div>
                           <div className="flex-1 min-w-0 py-1">
                              <p className="font-semibold text-white text-sm line-clamp-2 leading-tight">{result.subtitle}</p>
                              <div className="flex items-center gap-1.5 mt-2">
                                <img src={`https://api.dicebear.com/9.x/notionists/svg?seed=${result.title}`} className="w-4 h-4 rounded-full bg-slate-700" />
                                <span className="text-[10px] text-slate-400 font-medium truncate">{result.title}</span>
                              </div>
                           </div>
                        </Link>
                      )}
                    </motion.div>
                  ))
                )}
              </AnimatePresence>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
