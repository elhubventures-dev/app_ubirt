import { useState, useEffect } from "react";
import { Link, useParams, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { dataProvider } from "@/api/dataProvider";

export default function HashtagFeed() {
  const { tag } = useParams();
  const navigate = useNavigate();
  const [uploads, setUploads] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    setIsLoading(true);
    dataProvider.getFeed("hashtag", tag).then((hashtagPosts) => {
      setUploads(hashtagPosts);
      setIsLoading(false);
    }).catch(() => {
      setUploads([]);
      setIsLoading(false);
    });
  }, [tag]);

  return (
    <div className="flex flex-col min-h-[100dvh] bg-[#0a0f16] text-white">
      {/* Header */}
      <header className="shrink-0 px-4 py-4 bg-[#101822] border-b border-white/5 flex items-center justify-between z-10 shadow-sm relative sticky top-0">
        <button onClick={() => navigate(-1)} className="text-[#3b82f6] flex items-center gap-1 hover:bg-white/5 rounded-full p-1.5 -ml-1.5 transition-colors">
          <span className="material-symbols-outlined text-[24px]">arrow_back_ios</span>
        </button>
        <h1 className="text-base font-bold tracking-wide absolute left-1/2 -translate-x-1/2 flex items-center gap-1">
           <div className="w-6 h-6 rounded-full bg-[#3b82f6] text-white flex items-center justify-center font-black text-xs mr-1">#</div>
           {tag}
        </h1>
        <button className="text-slate-400 p-2 hover:text-white transition-colors">
          <span className="material-symbols-outlined">share</span>
        </button>
      </header>

      {/* Hashtag Stats Overlay */}
      <div className="px-4 py-6 bg-gradient-to-b from-[#101822] to-transparent">
         <div className="flex gap-4 items-center">
            <div className="w-20 h-20 rounded-full border-4 border-white/10 flex items-center justify-center bg-white/5 shadow-xl shrink-0">
               <span className="text-3xl font-black text-[#3b82f6]">#</span>
            </div>
            <div>
               <h2 className="text-2xl font-bold text-white capitalize">{tag}</h2>
               <p className="text-sm text-slate-400 font-semibold mt-1">45.2M Views • 12k Posts</p>
               <button className="mt-3 bg-red-500 hover:bg-red-600 text-white font-bold py-1.5 px-6 rounded-full text-sm transition-colors shadow-lg shadow-red-500/20 flex items-center gap-1">
                  <span className="material-symbols-outlined text-[16px]">bookmark</span> Add to Favorites
               </button>
            </div>
         </div>
      </div>

      {/* Video Grid */}
      <div className="flex-1 p-0.5">
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
                    {upload.mux_playback_id ? (
                      <img src={`https://image.mux.com/${upload.mux_playback_id}/thumbnail.jpg?width=300&height=400&fit_mode=crop`} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110 opacity-80" />
                    ) : upload.media_type === "image" ? (
                      <img src={upload.media_url} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110 opacity-80" />
                    ) : (
                      <video src={upload.media_url} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110 opacity-80" />
                    )}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex flex-col justify-end p-2">
                       <p className="text-white text-[10px] font-semibold truncate">@{upload.author}</p>
                       <div className="flex items-center gap-1 mt-0.5 text-slate-300">
                         <span className="material-symbols-outlined text-[12px] play_arrow">play_arrow</span>
                         <span className="text-[10px] font-medium">{upload.likes}</span>
                       </div>
                    </div>
                 </div>
              ))}
           </div>
        )}
      </div>
    </div>
  );
}
