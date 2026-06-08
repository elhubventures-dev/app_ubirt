import { Link, useNavigate, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { dataProvider } from "@/api/dataProvider";
import { feedPostPath } from "@/lib/feedLinks";

export default function LocationFeed() {
  const { tag } = useParams();
  const navigate = useNavigate();
  const decoded = decodeURIComponent(tag ?? "");

  const { data: posts = [], isLoading } = useQuery({
    queryKey: ["location-posts", decoded],
    queryFn: () => dataProvider.getPostsByLocation(decoded),
    enabled: Boolean(decoded),
  });

  return (
    <div className="min-h-screen bg-[#101822] text-white pb-10">
      <header className="px-4 pt-[calc(env(safe-area-inset-top)+0.5rem)] pb-4 flex items-center gap-3 border-b border-white/5">
        <button type="button" onClick={() => navigate(-1)} className="text-slate-400 p-2">
          <span className="material-symbols-outlined">arrow_back</span>
        </button>
        <div>
          <h1 className="text-lg font-bold flex items-center gap-1">
            <span className="material-symbols-outlined text-emerald-400">location_on</span>
            {decoded}
          </h1>
          <p className="text-xs text-slate-400">{posts.length} posts</p>
        </div>
      </header>
      <div className="p-4 grid grid-cols-2 gap-2">
        {isLoading ? (
          <p className="text-slate-400 col-span-2">Loading...</p>
        ) : (
          posts.map((post) => (
            <button
              key={post.id}
              type="button"
              onClick={() => navigate(feedPostPath(post.id))}
              className="aspect-[3/4] rounded-2xl overflow-hidden bg-slate-800"
            >
              <img src={post.media_url} alt="" className="w-full h-full object-cover" />
            </button>
          ))
        )}
      </div>
    </div>
  );
}
