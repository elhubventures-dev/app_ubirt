import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import PageHeader from "@/components/layout/PageHeader";

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
      <PageHeader
        onBack={() => navigate(-1)}
        center={
          <h1 className="text-base font-bold tracking-wide flex items-center gap-1 text-white">
            <span className="w-6 h-6 rounded-full bg-[#3b82f6] text-white flex items-center justify-center font-black text-xs">#</span>
            {tag}
          </h1>
        }
        right={
          <button type="button" className="min-w-11 min-h-11 flex items-center justify-center text-slate-400 hover:text-white rounded-full hover:bg-white/5 transition-colors">
            <span className="material-symbols-outlined">share</span>
          </button>
        }
        className="sticky top-0 bg-[#101822]"
      />

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
