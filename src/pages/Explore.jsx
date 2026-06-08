import { Link, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { dataProvider } from "@/api/dataProvider";
import { SOUND_LIBRARY } from "@/lib/soundLibrary";
import SuggestedCreators from "@/components/discovery/SuggestedCreators";
import { feedPostPath } from "@/lib/feedLinks";
import { motion } from "framer-motion";

export default function Explore() {
  const navigate = useNavigate();

  const { data: explore, isLoading } = useQuery({
    queryKey: ["explore"],
    queryFn: () => dataProvider.getExploreFeed(),
  });

  const trendingPosts = explore?.trendingPosts ?? [];
  const trendingTags = explore?.trendingTags ?? [];
  const locationTags = explore?.locationTags ?? [];
  const soundTrends = explore?.soundTrends ?? [];

  return (
    <div className="flex flex-col min-h-full pb-24 pt-2 px-4">
      <header className="mb-4 px-1">
        <h1 className="text-2xl font-bold text-white">Explore</h1>
        <p className="text-sm text-slate-400 mt-1">Trending posts, sounds, and places on UBIRT</p>
      </header>

      <SuggestedCreators title="Suggested for you" limit={6} />

      <section className="mt-6">
        <h2 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-3">Hot right now</h2>
        {isLoading ? (
          <div className="grid grid-cols-2 gap-2">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="aspect-[3/4] rounded-2xl bg-white/5 animate-pulse" />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-2">
            {trendingPosts.slice(0, 8).map((post) => (
              <button
                key={post.id}
                type="button"
                onClick={() => navigate(feedPostPath(post.id))}
                className="aspect-[3/4] rounded-2xl overflow-hidden relative bg-slate-800 text-left"
              >
                <img
                  src={post.media_url || `https://api.dicebear.com/9.x/shapes/svg?seed=${post.id}`}
                  alt=""
                  className="w-full h-full object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-transparent to-transparent flex flex-col justify-end p-2">
                  <p className="text-[10px] text-white font-semibold truncate">@{post.username}</p>
                  <p className="text-[10px] text-slate-300 truncate">{post.caption}</p>
                  <p className="text-[9px] text-amber-400 mt-0.5">{post.views?.toLocaleString()} views</p>
                </div>
              </button>
            ))}
          </div>
        )}
      </section>

      <section className="mt-8">
        <h2 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-3">Trending tags</h2>
        <div className="flex flex-wrap gap-2">
          {trendingTags.map((tag) => (
            <Link
              key={tag}
              to={`/tag/${tag.replace("#", "")}`}
              className="px-3 py-1.5 rounded-full bg-white/5 border border-white/10 text-sm text-[#3b82f6] font-semibold hover:bg-white/10"
            >
              {tag}
            </Link>
          ))}
        </div>
      </section>

      <section className="mt-8">
        <h2 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-3">Trending sounds</h2>
        <div className="space-y-2">
          {(soundTrends.length ? soundTrends : SOUND_LIBRARY.filter((s) => s.id !== "original").slice(0, 5)).map(
            (sound) => (
              <Link
                key={sound.id}
                to={`/sound/${sound.id}`}
                className="flex items-center gap-3 p-3 rounded-2xl bg-white/5 border border-white/10 hover:bg-white/10 transition-colors"
              >
                <div className="w-11 h-11 rounded-xl bg-violet-500/20 flex items-center justify-center shrink-0">
                  <span className="material-symbols-outlined text-violet-400">music_note</span>
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-white truncate">{sound.name}</p>
                  <p className="text-xs text-slate-400 truncate">{sound.author}</p>
                </div>
                {sound.postCount != null ? (
                  <span className="text-xs text-slate-500 shrink-0">{sound.postCount} posts</span>
                ) : null}
              </Link>
            )
          )}
        </div>
      </section>

      {locationTags.length > 0 && (
        <section className="mt-8 mb-4">
          <h2 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-3">Popular locations</h2>
          <div className="flex flex-wrap gap-2">
            {locationTags.map((loc) => (
              <Link
                key={loc.tag}
                to={`/explore/location/${encodeURIComponent(loc.tag)}`}
                className="px-3 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-sm text-emerald-300 font-medium hover:bg-emerald-500/20 flex items-center gap-1"
              >
                <span className="material-symbols-outlined text-[16px]">location_on</span>
                {loc.tag} ({loc.count})
              </Link>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
