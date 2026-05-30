import { useState, useEffect } from "react";
import { Link, useParams, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { PrimaryButton, getButtonClasses } from "@/components/ui/PrimaryButton";
import { dataProvider } from "@/api/dataProvider";

export default function UserProfile() {
  const { username } = useParams();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState("grid"); // 'grid' | 'liked'
  const [isFollowing, setIsFollowing] = useState(false);
  const [uploads, setUploads] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    setIsLoading(true);
    dataProvider.getFeed("foryou").then((allFeedPosts) => {
      // Filter by the URL parameter 'username' (which maps to post.author)
      const userUploads = allFeedPosts.filter(p => p.author.toLowerCase() === username.toLowerCase() || p.handle === `@${username.toLowerCase()}`);
      setUploads(userUploads.length > 0 ? userUploads : allFeedPosts.slice(0, 4));
      setIsLoading(false);
    }).catch(() => {
      setUploads([]);
      setIsLoading(false);
    });
  }, [username]);

  const bannerUrl = `https://images.unsplash.com/photo-1557683311-eac922347aa1?w=800&h=300&fit=crop&q=80`;

  return (
    <div className="flex flex-col min-h-[100dvh] bg-[#0a0f16] pb-6 relative overflow-x-hidden">
      {/* Top Nav Overlay */}
      <div className="absolute top-0 left-0 right-0 p-4 z-50 flex justify-between items-center bg-gradient-to-b from-black/60 to-transparent">
         <button onClick={() => navigate(-1)} className="w-10 h-10 rounded-full bg-black/40 backdrop-blur-md flex items-center justify-center text-white">
            <span className="material-symbols-outlined">arrow_back</span>
         </button>
         <button className="w-10 h-10 rounded-full bg-black/40 backdrop-blur-md flex items-center justify-center text-white">
            <span className="material-symbols-outlined">more_horiz</span>
         </button>
      </div>

      {/* Dynamic Header */}
      <div className="relative h-48 sm:h-56 rounded-b-[2rem] overflow-hidden shadow-2xl shrink-0">
        <img src={bannerUrl} alt="Cover" className="w-full h-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-t from-[#101822] via-[#101822]/50 to-transparent opacity-90" />
      </div>

      {/* Profile Info Overlay */}
      <div className="px-4 relative -mt-16 flex flex-col items-center sm:items-start sm:flex-row sm:gap-6 shrink-0">
        <div className="relative">
          <div className="w-28 h-28 rounded-full border-4 border-[#101822] bg-slate-800 overflow-hidden shadow-xl relative z-10">
            <img src={`https://api.dicebear.com/9.x/notionists/svg?seed=${username}`} alt={username} className="w-full h-full object-cover" />
          </div>
        </div>

        <div className="mt-3 sm:mt-16 text-center sm:text-left flex-1">
          <h1 className="text-2xl font-bold tracking-tight text-white capitalize">{username}</h1>
          <p className="text-sm font-medium text-[#3b82f6]">@{username}</p>
          <p className="mt-2 text-sm text-slate-300 max-w-sm mx-auto sm:mx-0">
            Content creator exploring the digital frontier.
          </p>
          
          <div className="mt-4 flex gap-6 justify-center sm:justify-start">
             <div className="text-center">
                <p className="text-white font-bold text-lg">1.2M</p>
                <p className="text-slate-400 text-xs font-semibold uppercase">Followers</p>
             </div>
             <div className="text-center">
                <p className="text-white font-bold text-lg">240</p>
                <p className="text-slate-400 text-xs font-semibold uppercase">Following</p>
             </div>
             <div className="text-center">
                <p className="text-white font-bold text-lg">18.5M</p>
                <p className="text-slate-400 text-xs font-semibold uppercase">Likes</p>
             </div>
          </div>

          <div className="mt-6 flex gap-3 justify-center sm:justify-start">
            <button 
               onClick={() => setIsFollowing(!isFollowing)}
               className={`flex-1 max-w-[200px] h-10 rounded-full font-bold text-sm transition-colors ${
                 isFollowing 
                  ? "bg-white/10 text-white hover:bg-white/20 border border-white/20" 
                  : "bg-[#3b82f6] text-white hover:bg-[#2563eb]"
               }`}
            >
               {isFollowing ? "Following" : "Follow"}
            </button>
            <button className="w-10 h-10 rounded-full border border-white/20 bg-white/5 flex items-center justify-center hover:bg-white/10 transition-colors">
               <span className="material-symbols-outlined text-[20px] text-white">mail</span>
            </button>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="mt-8 flex justify-center border-b border-white/5 relative shrink-0">
        {[
          { id: "grid", icon: "grid_view" },
          { id: "liked", icon: "favorite" }
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`relative px-8 py-3 transition-colors ${
              activeTab === tab.id ? "text-white" : "text-slate-500"
            }`}
          >
            {activeTab === tab.id && (
              <motion.div
                layoutId="userProfileTab"
                className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#3b82f6] shadow-[0_0_8px_rgba(59,130,246,0.8)]"
              />
            )}
            <span className="material-symbols-outlined">{tab.icon}</span>
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div className="mt-2 flex-1 min-h-[300px]">
        <AnimatePresence mode="wait">
          {activeTab === "grid" ? (
            <motion.div
              key="grid"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
            >
              {isLoading ? (
                <p className="text-center text-slate-400 mt-10">Loading...</p>
              ) : uploads.length === 0 ? (
                <div className="text-center py-16 px-4">
                  <span className="material-symbols-outlined text-[48px] text-slate-600">grid_view</span>
                  <p className="text-slate-300 mt-4 font-semibold">No posts yet</p>
                </div>
              ) : (
                <div className="grid grid-cols-3 gap-0.5">
                  {uploads.map((upload) => (
                    <div key={upload.id} className="aspect-[3/4] bg-slate-800 relative group cursor-pointer overflow-hidden">
                      <img 
                        src={`https://images.unsplash.com/photo-1616469829581-73993eb86b02?w=300&h=400&fit=crop&q=80&seed=${upload.id}`} 
                        alt="Thumbnail" 
                        className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110 opacity-80" 
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex flex-col justify-end p-2">
                         <div className="flex items-center gap-1 mt-1 text-slate-300">
                           <span className="material-symbols-outlined text-[14px] play_arrow">play_arrow</span>
                           <span className="text-[10px] font-medium">{Math.floor(Math.random() * 1000)}K</span>
                         </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </motion.div>
          ) : (
            <motion.div
              key="liked"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
            >
               <div className="text-center py-16 px-4">
                  <span className="material-symbols-outlined text-[48px] text-slate-600">lock</span>
                  <p className="text-slate-300 mt-4 font-semibold">This user's liked videos are private</p>
               </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
