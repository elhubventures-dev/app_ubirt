import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { dataProvider } from "@/api/dataProvider";
import { motion, AnimatePresence } from "framer-motion";
import { useQuery } from "@tanstack/react-query";
import { feedPostPath } from "@/lib/feedLinks";
import { searchSounds, SOUND_LIBRARY } from "@/lib/soundLibrary";
import { usePageStateRestore } from "@/hooks/usePageStateRestore";

const SEARCH_DEFAULT = {
  term: "",
  activeTab: "top",
  showFilters: false,
  dateFilter: "any",
  sortBy: "relevant",
};

const DATE_FILTERS = {
  any: null,
  today: 1,
  week: 7,
  month: 30,
};
const SORT_OPTIONS = ["relevant", "likes", "views"];

export default function Search() {
  const [searchState, setSearchState] = usePageStateRestore("search", SEARCH_DEFAULT);
  const { term, activeTab, showFilters, dateFilter, sortBy } = searchState;
  const [debouncedTerm, setDebouncedTerm] = useState(term.trim());

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedTerm(term.trim()), 300);
    return () => clearTimeout(timer);
  }, [term]);

  const searchOptions = useMemo(() => {
    const days = DATE_FILTERS[dateFilter];
    const since = days ? new Date(Date.now() - days * 86400000).toISOString() : null;
    return {
      since,
      sort: sortBy === "relevant" ? undefined : sortBy,
    };
  }, [dateFilter, sortBy]);

  const { data: searchResults, isLoading: isSearching } = useQuery({
    queryKey: ["search", debouncedTerm, searchOptions],
    queryFn: () => dataProvider.search(debouncedTerm, searchOptions),
    enabled: debouncedTerm.length > 0,
  });

  const { data: suggested = [] } = useQuery({
    queryKey: ["suggested-creators"],
    queryFn: () => dataProvider.getSuggestedCreators(),
    enabled: !debouncedTerm,
  });

  const { data: trendingTags = [] } = useQuery({
    queryKey: ["trending-tags"],
    queryFn: () => dataProvider.getTrendingTags(),
    enabled: !debouncedTerm,
  });

  const results = useMemo(() => {
    if (!debouncedTerm) return { top: [], users: [], videos: [], sounds: [], tags: [] };
    const users = searchResults?.users ?? [];
    const videos = (searchResults?.posts ?? []).map((p) => ({
      id: p.id,
      type: "video",
      title: p.author,
      subtitle: p.caption,
      ...p,
    }));
    const sounds = searchSounds(debouncedTerm).map((track) => ({
      id: track.id,
      type: "sound",
      title: track.name,
      subtitle: track.author,
      duration: track.duration,
    }));
    const tags = (searchResults?.tags ?? []).map((tag, i) => ({
      id: `tag-${i}`,
      type: "tag",
      title: tag,
      subtitle: "Hashtag",
    }));

    return {
      top: [...users.slice(0, 2), ...videos.slice(0, 2), ...sounds.slice(0, 1), ...tags.slice(0, 1)],
      users,
      videos,
      sounds,
      tags,
    };
  }, [debouncedTerm, searchResults]);

  const activeResults = results[activeTab];

  return (
    <div className="flex flex-col min-h-full pb-20 pt-2 px-4 relative overflow-hidden">
      <div className="absolute inset-0 pointer-events-none bg-gradient-to-tr from-[#0a111a] via-[#101822] to-[#152336] z-0" />

      <div className="relative z-10">
        <h1 className="text-2xl font-bold text-white mb-4">Discover</h1>

        <div className="relative group">
          <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none">
            <span className="material-symbols-outlined text-slate-400 group-focus-within:text-[#3b82f6] transition-colors">search</span>
          </div>
          <input
            type="text"
            value={term}
            onChange={(e) => setSearchState((s) => ({ ...s, term: e.target.value }))}
            placeholder="Search creators, posts, sounds, tags..."
            className="w-full bg-[#1a2332]/80 backdrop-blur-md border border-white/10 rounded-full py-3.5 pl-12 pr-4 text-white placeholder-slate-400 focus:outline-none focus:border-[#3b82f6]/50 focus:ring-1 focus:ring-[#3b82f6]/50 transition-all shadow-inner"
          />
          {term && (
            <button type="button" onClick={() => setSearchState((s) => ({ ...s, term: "" }))} className="absolute inset-y-0 right-12 flex items-center text-slate-400 hover:text-white">
              <span className="material-symbols-outlined text-[20px]">close</span>
            </button>
          )}
          <button
            type="button"
            onClick={() => setSearchState((s) => ({ ...s, showFilters: !s.showFilters }))}
            className={`absolute inset-y-0 right-2 flex items-center p-2 rounded-full transition-colors ${showFilters ? "text-[#3b82f6] bg-[#3b82f6]/10" : "text-slate-400 hover:text-white"}`}
          >
            <span className="material-symbols-outlined text-[20px]">tune</span>
          </button>
        </div>

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
                   <select
                     value={dateFilter}
                     onChange={(e) => setSearchState((s) => ({ ...s, dateFilter: e.target.value }))}
                     className="bg-white/5 border border-white/10 rounded-lg px-2 py-1 outline-none"
                   >
                     <option value="any">Any time</option>
                     <option value="today">Today</option>
                     <option value="week">This Week</option>
                     <option value="month">This Month</option>
                   </select>
                </div>
                <div className="flex justify-between items-center">
                   <span className="font-semibold text-slate-300">Popularity</span>
                   <select
                     value={sortBy}
                     onChange={(e) => setSearchState((s) => ({ ...s, sortBy: e.target.value }))}
                     className="bg-white/5 border border-white/10 rounded-lg px-2 py-1 outline-none"
                   >
                     <option value="relevant">Most Relevant</option>
                     <option value="likes">Most Liked</option>
                     <option value="views">Most Viewed</option>
                   </select>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {!debouncedTerm && (
          <div className="mt-6">
            <h2 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3 px-1">Trending Tags</h2>
            <div className="flex gap-2 overflow-x-auto hide-scrollbar pb-2 -mx-4 px-4">
              {trendingTags.map((tag) => (
                <Link key={tag} to={`/tag/${tag.replace("#", "")}`} className="shrink-0 bg-white/5 hover:bg-[#3b82f6]/20 border border-white/10 hover:border-[#3b82f6]/30 px-4 py-2 rounded-full text-sm font-medium text-slate-300 hover:text-[#3b82f6] transition-colors whitespace-nowrap flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-[16px]">trending_up</span> {tag}
                </Link>
              ))}
            </div>

            <div className="mt-8">
              <h2 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3 px-1">Popular Sounds</h2>
              <div className="space-y-2">
                {SOUND_LIBRARY.filter((track) => track.id !== "original")
                  .slice(0, 4)
                  .map((track) => (
                    <Link
                      key={track.id}
                      to={`/upload?sound=${track.id}`}
                      className="bg-white/5 border border-white/10 p-3 rounded-2xl flex items-center gap-3 hover:bg-white/10 transition-colors"
                    >
                      <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-[#3b82f6] to-purple-500 flex items-center justify-center shrink-0">
                        <span className="material-symbols-outlined text-white text-[20px]">music_note</span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-sm text-white truncate">{track.name}</p>
                        <p className="text-xs text-slate-400 truncate">{track.author}</p>
                      </div>
                      <span className="text-xs font-mono text-slate-500 shrink-0">{track.duration}</span>
                    </Link>
                  ))}
              </div>
            </div>

            <div className="mt-8">
               <h2 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3 px-1">Suggested Creators</h2>
               <div className="grid grid-cols-2 gap-3">
                 {suggested.map((creator) => (
                   <Link key={creator.id} to={`/user/${creator.username}`} className="bg-white/5 border border-white/10 p-3 rounded-2xl flex items-center gap-3 hover:bg-white/10 transition-colors">
                      <div className="w-10 h-10 rounded-full bg-slate-800 overflow-hidden shrink-0">
                        <img src={creator.avatar || `https://api.dicebear.com/9.x/notionists/svg?seed=${creator.username}`} className="w-full h-full object-cover" alt="" />
                      </div>
                      <div className="min-w-0">
                         <p className="font-semibold text-sm text-white truncate">{creator.name}</p>
                         <p className="text-xs text-slate-400 truncate">@{creator.username}</p>
                      </div>
                   </Link>
                 ))}
               </div>
            </div>
          </div>
        )}

        {debouncedTerm && (
          <div className="mt-6">
            <div className="flex gap-4 border-b border-white/10 mb-4 pb-0.5 overflow-x-auto hide-scrollbar">
              {[
                { id: "top", label: "Top" },
                { id: "users", label: "Users" },
                { id: "videos", label: "Posts" },
                { id: "sounds", label: "Sounds" },
                { id: "tags", label: "Tags" },
              ].map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setSearchState((s) => ({ ...s, activeTab: tab.id }))}
                  className={`py-2 text-sm font-semibold relative transition-colors whitespace-nowrap ${activeTab === tab.id ? "text-[#3b82f6]" : "text-slate-400 hover:text-slate-200"}`}
                >
                  {tab.label}
                  {activeTab === tab.id && (
                    <motion.div layoutId="searchTabIndicator" className="absolute bottom-[-1px] left-0 right-0 h-0.5 bg-[#3b82f6]" />
                  )}
                </button>
              ))}
            </div>

            <div className="space-y-3">
              {isSearching ? (
                <p className="text-center text-slate-400 py-10">Searching...</p>
              ) : (
                <AnimatePresence mode="popLayout">
                  {activeResults.length === 0 ? (
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center py-10">
                      <span className="material-symbols-outlined text-[48px] text-slate-600">search_off</span>
                      <p className="text-slate-400 mt-2">No results found for "{debouncedTerm}"</p>
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
                        {result.type === "user" || result.username ? (
                          <Link to={`/user/${result.username || result.title}`} className="bg-white/5 border border-white/5 p-3 rounded-2xl flex items-center gap-3">
                            <div className="w-12 h-12 rounded-full bg-slate-800 overflow-hidden shrink-0">
                               <img src={result.avatar || `https://api.dicebear.com/9.x/notionists/svg?seed=${result.username || result.title}`} className="w-full h-full object-cover" alt="" />
                            </div>
                            <div className="flex-1 min-w-0">
                               <p className="font-semibold text-white truncate">{result.name || result.title}</p>
                               <p className="text-xs text-slate-400 truncate">@{result.username || result.title}</p>
                            </div>
                          </Link>
                        ) : result.type === "sound" ? (
                          <Link
                            to={`/upload?sound=${result.id}`}
                            className="bg-white/5 border border-white/5 p-3 rounded-2xl flex items-center gap-3 group hover:bg-white/10 transition-colors"
                          >
                            <div className="w-12 h-12 bg-gradient-to-br from-[#3b82f6] to-purple-500 rounded-lg flex items-center justify-center shrink-0 shadow-inner">
                              <span className="material-symbols-outlined text-white">music_note</span>
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="font-semibold text-white text-sm truncate">{result.title}</p>
                              <p className="text-[10px] text-slate-400 font-medium truncate">{result.subtitle}</p>
                            </div>
                            {result.duration ? (
                              <span className="text-xs font-mono text-slate-500 shrink-0">{result.duration}</span>
                            ) : null}
                          </Link>
                        ) : result.type === "tag" ? (
                          <Link
                            to={`/tag/${String(result.title).replace("#", "")}`}
                            className="bg-white/5 border border-white/5 p-3 rounded-2xl flex items-center gap-3 group hover:bg-white/10 transition-colors"
                          >
                            <div className="w-12 h-12 bg-white/10 rounded-lg flex items-center justify-center shrink-0">
                              <span className="material-symbols-outlined text-[#3b82f6]">tag</span>
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="font-semibold text-white text-sm truncate">{result.title}</p>
                              <p className="text-[10px] text-slate-400 font-medium truncate">Hashtag</p>
                            </div>
                          </Link>
                        ) : (
                          <Link to={feedPostPath(result.id)} className="bg-white/5 border border-white/5 p-3 rounded-2xl flex gap-3 group">
                             <div className="w-16 h-20 bg-slate-800 rounded-lg overflow-hidden shrink-0 relative">
                               <img src={result.media_url || `https://images.unsplash.com/photo-1616469829581-73993eb86b02?w=150&h=200&fit=crop&q=80&seed=${result.id}`} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500 opacity-80" alt="" />
                             </div>
                             <div className="flex-1 min-w-0 py-1">
                                <p className="font-semibold text-white text-sm line-clamp-2 leading-tight">{result.subtitle || result.caption}</p>
                                <div className="flex items-center gap-1.5 mt-2">
                                  <span className="text-[10px] text-slate-400 font-medium truncate">{result.title || result.author}</span>
                                </div>
                             </div>
                          </Link>
                        )}
                      </motion.div>
                    ))
                  )}
                </AnimatePresence>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
