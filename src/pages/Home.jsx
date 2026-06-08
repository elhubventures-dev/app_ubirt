import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/lib/AuthContext";
import { useCreatorStudio } from "@/hooks/useCreatorStudio";
import { formatCount } from "@/lib/formatStats";
import { motion } from "framer-motion";
import NotificationBell from "@/components/layout/NotificationBell";
import SuggestedCreators from "@/components/discovery/SuggestedCreators";
import { useQuery } from "@tanstack/react-query";
import { dataProvider } from "@/api/dataProvider";

export default function Home() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { data: trendingPosts = [], isLoading: isLoadingTrending } = useQuery({
    queryKey: ["trending-posts"],
    queryFn: () => dataProvider.getTrendingPosts(5),
  });
  const { data: stats } = useCreatorStudio();

  const greeting = new Date().getHours() < 12 ? "Good Morning" : new Date().getHours() < 18 ? "Good Afternoon" : "Good Evening";

  return (
    <div className="flex flex-col min-h-full pb-20 pt-4 px-4 overflow-hidden relative">
      {/* Premium Background */}
      <div className="absolute inset-0 pointer-events-none bg-gradient-to-br from-[#0a111a] via-[#101822] to-[#152336] z-0" />
      <div className="absolute top-0 right-0 w-[60%] h-[40%] bg-[#3b82f6]/10 blur-[100px] rounded-full z-0 pointer-events-none" />

      <div className="relative z-10 space-y-6">
        {/* Header Greeting */}
        <header className="flex justify-between items-center">
          <div>
            <motion.p initial={{ opacity: 0, y: -5 }} animate={{ opacity: 1, y: 0 }} className="text-[#3b82f6] text-xs font-bold uppercase tracking-wider">
              {greeting}
            </motion.p>
            <motion.h1 initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.1 }} className="text-2xl font-bold text-white mt-1 tracking-tight">
              {user?.name || "Creator"}
            </motion.h1>
          </div>
          <div className="flex items-center gap-2">
            <NotificationBell />
            <Link to="/profile" className="w-12 h-12 rounded-full bg-slate-800 border-2 border-white/10 overflow-hidden hover:border-[#3b82f6]/50 transition-colors shadow-lg">
              <img src={user?.avatar || `https://api.dicebear.com/9.x/notionists/svg?seed=${user?.username || "default"}`} alt="Profile" className="w-full h-full object-cover" />
            </Link>
          </div>
        </header>

        {/* Mini Analytics Overview */}
        <motion.section 
          initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
          className="bg-gradient-to-r from-white/10 to-white/5 border border-white/10 p-5 rounded-3xl shadow-xl backdrop-blur-md relative overflow-hidden"
        >
          <div className="absolute -right-10 -top-10 w-32 h-32 bg-[#3b82f6]/20 blur-3xl rounded-full pointer-events-none" />
          <h2 className="text-sm font-semibold text-slate-300 mb-4 flex items-center gap-2">
            <span className="material-symbols-outlined text-[18px] text-[#3b82f6]">analytics</span>
            Quick Insights
          </h2>
          <div className="grid grid-cols-2 gap-4">
             <div>
               <p className="text-xs text-slate-400 uppercase font-medium">Followers</p>
               <div className="flex items-end gap-2 mt-1">
                 <p className="text-3xl font-bold text-white">{formatCount(stats?.followers ?? 0)}</p>
               </div>
             </div>
             <div>
               <p className="text-xs text-slate-400 uppercase font-medium">Total Views</p>
               <div className="flex items-end gap-2 mt-1">
                 <p className="text-3xl font-bold text-white">{formatCount(stats?.views ?? 0)}</p>
               </div>
             </div>
          </div>
        </motion.section>

        {/* Quick Actions */}
        <section>
          <h2 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-3 px-1">Studio Tools</h2>
          <div className="grid grid-cols-2 gap-3">
             <Link to="/create" className="bg-gradient-to-br from-[#3b82f6] to-[#1e40af] p-4 rounded-3xl text-white hover:scale-[1.02] active:scale-[0.98] transition-transform shadow-[0_4px_14px_rgba(59,130,246,0.4)] flex flex-col items-start gap-3">
               <div className="p-2 bg-white/20 rounded-full">
                  <span className="material-symbols-outlined text-[24px]">photo_camera</span>
               </div>
               <div>
                 <h3 className="font-bold text-base">Camera</h3>
                 <p className="text-xs text-blue-200 mt-0.5">Take a photo</p>
               </div>
             </Link>
             <Link to="/upload" className="bg-white/5 border border-white/10 p-4 rounded-3xl hover:bg-white/10 hover:scale-[1.02] active:scale-[0.98] transition-all flex flex-col items-start gap-3 backdrop-blur-sm">
               <div className="p-2 bg-[#3b82f6]/20 text-[#3b82f6] rounded-full">
                  <span className="material-symbols-outlined text-[24px]">add_circle</span>
               </div>
               <div>
                 <h3 className="font-bold text-white text-base">Upload</h3>
                 <p className="text-xs text-slate-400 mt-0.5">JPG or PNG</p>
               </div>
             </Link>
             <Link to="/creator-studio" className="bg-white/5 border border-white/10 p-4 rounded-3xl hover:bg-white/10 hover:scale-[1.02] active:scale-[0.98] transition-all flex flex-col items-start gap-3 backdrop-blur-sm">
               <div className="p-2 bg-emerald-500/20 text-emerald-400 rounded-full">
                  <span className="material-symbols-outlined text-[24px]">dashboard</span>
               </div>
               <div>
                 <h3 className="font-bold text-white text-base">Manage</h3>
                 <p className="text-xs text-slate-400 mt-0.5">Your uploads</p>
               </div>
             </Link>
             <Link to="/explore" className="bg-white/5 border border-white/10 p-4 rounded-3xl hover:bg-white/10 hover:scale-[1.02] active:scale-[0.98] transition-all flex flex-col items-start gap-3 backdrop-blur-sm">
               <div className="p-2 bg-orange-500/20 text-orange-400 rounded-full">
                  <span className="material-symbols-outlined text-[24px]">explore</span>
               </div>
               <div>
                 <h3 className="font-bold text-white text-base">Explore</h3>
                 <p className="text-xs text-slate-400 mt-0.5">Trending & sounds</p>
               </div>
             </Link>
          </div>
        </section>

        <SuggestedCreators title="Creators to follow" limit={4} />

        {/* Trending Snippet */}
        <section>
          <div className="flex justify-between items-end mb-3 px-1">
             <h2 className="text-sm font-bold text-slate-400 uppercase tracking-wider">Trending on UBIRT</h2>
             <Link to="/explore" className="text-xs font-bold text-[#3b82f6] flex items-center hover:text-white transition-colors">Explore <span className="material-symbols-outlined text-[14px]">chevron_right</span></Link>
          </div>
          <div className="flex gap-3 overflow-x-auto snap-x hide-scrollbar pb-4 -mx-4 px-4">
             {isLoadingTrending ? (
                [1,2,3].map(i => <div key={i} className="w-32 h-48 shrink-0 bg-white/5 rounded-2xl animate-pulse" />)
             ) : (
                trendingPosts.map((post) => (
                  <button
                    key={post.id}
                    type="button"
                    onClick={() => navigate(feedPostPath(post.id))}
                    className="w-32 h-48 shrink-0 snap-start bg-slate-800 rounded-2xl overflow-hidden relative group shadow-lg ring-1 ring-white/5 text-left"
                  >
                     <img
                        src={post.media_url || `https://api.dicebear.com/9.x/shapes/svg?seed=${post.id}`}
                        alt="Thumbnail"
                        className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500 opacity-80"
                        onError={(e) => {
                          e.currentTarget.src = `https://api.dicebear.com/9.x/shapes/svg?seed=${post.id}`;
                        }}
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-transparent to-transparent flex flex-col justify-end p-3 pointer-events-none">
                        <div className="flex items-center gap-1.5 mb-1">
                          <img src={`https://api.dicebear.com/9.x/notionists/svg?seed=${post.username || post.author}`} alt={post.author} className="w-4 h-4 rounded-full bg-slate-700" />
                          <span className="text-[10px] text-white font-medium truncate">{post.author}</span>
                        </div>
                        <p className="text-xs text-slate-300 font-medium truncate">{post.caption}</p>
                      </div>
                  </button>
                ))
             )}
          </div>
        </section>
      </div>
    </div>
  );
}
