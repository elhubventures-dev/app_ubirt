import { useNavigate, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { dataProvider } from "@/api/dataProvider";
import { getSoundById } from "@/lib/soundLibrary";
import { feedPostPath } from "@/lib/feedLinks";

export default function SoundTrends() {
  const { soundId } = useParams();
  const navigate = useNavigate();
  const soundMeta = getSoundById(soundId);

  const { data: posts = [], isLoading } = useQuery({
    queryKey: ["sound-posts", soundId],
    queryFn: () => dataProvider.getPostsBySound(soundId),
    enabled: Boolean(soundId),
  });

  return (
    <div className="min-h-screen bg-[#101822] text-white pb-10">
      <header className="px-4 pt-[calc(env(safe-area-inset-top)+0.5rem)] pb-4 flex items-center gap-3 border-b border-white/5">
        <button type="button" onClick={() => navigate(-1)} className="text-slate-400 p-2 hover:text-white">
          <span className="material-symbols-outlined">arrow_back</span>
        </button>
        <div>
          <h1 className="text-lg font-bold">{soundMeta?.name ?? "Sound"}</h1>
          <p className="text-xs text-slate-400">{soundMeta?.author ?? soundId} · {posts.length} posts</p>
        </div>
      </header>

      <div className="p-4">
        {isLoading ? (
          <p className="text-slate-400 text-sm">Loading posts...</p>
        ) : !posts.length ? (
          <div className="text-center py-16">
            <span className="material-symbols-outlined text-[48px] text-slate-600">music_off</span>
            <p className="text-slate-400 mt-4">No posts using this sound yet.</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-2">
            {posts.map((post) => (
              <button
                key={post.id}
                type="button"
                onClick={() => navigate(feedPostPath(post.id))}
                className="aspect-[3/4] rounded-2xl overflow-hidden relative bg-slate-800"
              >
                <img
                  src={post.media_url || `https://api.dicebear.com/9.x/shapes/svg?seed=${post.id}`}
                  alt=""
                  className="w-full h-full object-cover"
                />
                <div className="absolute bottom-0 left-0 right-0 p-2 bg-gradient-to-t from-black/80 to-transparent">
                  <p className="text-[10px] text-white truncate">@{post.username}</p>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
