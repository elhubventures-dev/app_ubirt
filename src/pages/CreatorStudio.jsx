import { useState } from "react";
import { Link } from "react-router-dom";
import { useCreatorStudio } from "@/hooks/useCreatorStudio";
import { useToast } from "@/components/ui/use-toast";
import { PrimaryButton } from "@/components/ui/PrimaryButton";
import { InputField } from "@/components/ui/InputField";
import { motion } from "framer-motion";
import { useQuery } from "@tanstack/react-query";
import { dataProvider } from "@/api/dataProvider";
import { formatCount } from "@/lib/formatStats";
import MonetizationSettings from "@/components/monetization/MonetizationSettings";

export default function CreatorStudio() {
  const { data: earnings, isLoading: isLoadingEarnings } = useQuery({
    queryKey: ["creator-earnings", 28],
    queryFn: () => dataProvider.getCreatorEarnings(28),
  });

  const { data: analytics, isLoading: isLoadingAnalytics } = useQuery({
    queryKey: ["creator-analytics", 28],
    queryFn: () => dataProvider.getCreatorAnalytics(28),
  });

  const {
    uploads = [],
    isLoadingUploads,
    updateUpload,
    publishUpload,
    isUpdatingUpload,
    isPublishingUpload,
  } = useCreatorStudio();

  const stats = analytics;
  const isLoading = isLoadingAnalytics;
  const [editingId, setEditingId] = useState("");
  const [draftTitle, setDraftTitle] = useState("");
  const [filter, setFilter] = useState("all");
  const { toast } = useToast();

  const startEdit = (upload) => {
    setEditingId(upload.id);
    setDraftTitle(upload.title);
  };

  const saveEdit = async () => {
    if (!editingId || !draftTitle.trim()) return;
    await updateUpload({ uploadId: editingId, patch: { title: draftTitle.trim() } });
    setEditingId("");
    setDraftTitle("");
    toast({ title: "Upload updated" });
  };

  const visibleUploads = filter === "all" ? uploads : uploads.filter((upload) => (upload.status ?? "draft") === filter);

  const performanceData = stats?.chartData ?? [0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
  const growthLabel =
    (stats?.growthPct ?? 0) >= 0
      ? `+${stats?.growthPct ?? 0}% this period`
      : `${stats?.growthPct ?? 0}% this period`;

  return (
    <div className="flex flex-col h-[100dvh] bg-[#0a0f16] text-white overflow-hidden">
      {/* Header */}
      <header className="shrink-0 px-4 py-4 bg-[#101822]/80 backdrop-blur-xl border-b border-white/5 flex items-center justify-between z-10 shadow-sm relative">
        <Link to="/" className="text-[#3b82f6] flex items-center gap-1 hover:bg-white/5 rounded-full p-1.5 -ml-1.5 transition-colors">
          <span className="material-symbols-outlined text-[24px]">arrow_back_ios</span>
        </Link>
        <h1 className="text-base font-bold tracking-wide absolute left-1/2 -translate-x-1/2">Analytics</h1>
        <button className="text-slate-400 p-2 hover:bg-white/5 rounded-full transition-colors">
          <span className="material-symbols-outlined text-[24px]">calendar_today</span>
        </button>
      </header>

      {/* Scrollable Content */}
      <div className="flex-1 overflow-y-auto hide-scrollbar relative z-0">
        <div className="absolute top-0 right-0 w-[80%] h-[30%] bg-[#3b82f6]/10 blur-[120px] rounded-full pointer-events-none" />

        <div className="px-4 py-6 max-w-4xl mx-auto space-y-6">
          {/* Overview Cards */}
          <section className="grid grid-cols-2 md:grid-cols-4 gap-3">
             <div className="bg-white/5 border border-white/10 p-4 rounded-3xl backdrop-blur-sm">
                <p className="text-xs text-slate-400 uppercase font-bold tracking-wider mb-1">Total Views</p>
                <div className="flex items-end gap-2">
                  <p className="text-2xl font-bold text-white">{isLoading ? "—" : formatCount(stats?.views ?? 0)}</p>
                </div>
             </div>
             <div className="bg-white/5 border border-white/10 p-4 rounded-3xl backdrop-blur-sm">
                <p className="text-xs text-slate-400 uppercase font-bold tracking-wider mb-1">Followers</p>
                <div className="flex items-end gap-2">
                  <p className="text-2xl font-bold text-white">{isLoading ? "—" : formatCount(stats?.followers ?? 0)}</p>
                </div>
             </div>
             <div className="bg-white/5 border border-white/10 p-4 rounded-3xl backdrop-blur-sm">
                <p className="text-xs text-slate-400 uppercase font-bold tracking-wider mb-1">Coins</p>
                <div className="flex items-end gap-2">
                  <p className="text-2xl font-bold text-white">{isLoading ? "—" : formatCount(stats?.earnings ?? 0)}</p>
                </div>
             </div>
             <div className="bg-gradient-to-br from-[#3b82f6]/20 to-transparent border border-[#3b82f6]/30 p-4 rounded-3xl backdrop-blur-sm">
                <p className="text-xs text-[#3b82f6] uppercase font-bold tracking-wider mb-1">Completion</p>
                <div className="flex items-end gap-2">
                  <p className="text-2xl font-bold text-white">{isLoading ? "—" : `${stats?.completionRate ?? 0}%`}</p>
                </div>
             </div>
          </section>

          {/* Performance Chart */}
          <section className="bg-white/5 border border-white/10 p-5 md:p-6 rounded-3xl backdrop-blur-sm">
             <div className="flex justify-between items-center mb-6">
                <div>
                  <h2 className="text-base font-bold">Performance (Last 28 Days)</h2>
                  <p className="text-xs text-slate-400 mt-0.5">{growthLabel}</p>
                </div>
             </div>
             
             {/* Custom CSS Bar Chart */}
             <div className="h-48 flex items-end justify-between gap-1 sm:gap-2 px-1 relative">
                {/* Horizontal Grid lines */}
                <div className="absolute inset-0 flex flex-col justify-between pointer-events-none z-0 border-t border-white/5">
                   <div className="border-b border-white/5 flex-1" />
                   <div className="border-b border-white/5 flex-1" />
                   <div className="border-b border-white/5 flex-1" />
                </div>
                {performanceData.map((h, i) => (
                  <div key={i} className="w-full flex justify-center group relative z-10 h-full items-end pb-1">
                     <motion.div initial={{ height: 0 }} animate={{ height: `${h}%` }} transition={{ duration: 0.8, delay: i * 0.05 }} className="w-full bg-[#3b82f6] rounded-t-sm group-hover:opacity-80 transition-opacity" />
                     <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 bg-[#1a2332] text-xs py-1 px-2 rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none shadow-lg border border-white/10 z-20 whitespace-nowrap">
                        Day {i + 1}
                     </div>
                  </div>
                ))}
             </div>
             <div className="flex justify-between mt-3 text-xs text-slate-500 font-medium px-2">
               <span>May 1</span>
               <span>May 14</span>
               <span>May 28</span>
             </div>
          </section>

          {/* Earnings dashboard */}
          <section className="bg-white/5 border border-white/10 p-5 md:p-6 rounded-3xl backdrop-blur-sm">
            <div className="flex justify-between items-center mb-4">
              <div>
                <h2 className="text-base font-bold">Earnings (28 days)</h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  {isLoadingEarnings ? "—" : `${(earnings?.totals?.all ?? 0).toLocaleString()} gift coins earned`}
                </p>
              </div>
              <Link to="/wallet" className="text-xs font-semibold text-[#3b82f6] hover:underline">
                Wallet →
              </Link>
            </div>
            <div className="grid grid-cols-3 gap-2 mb-4">
              <div className="rounded-xl bg-black/20 p-3 text-center">
                <p className="text-[10px] text-slate-500 uppercase">Gifts</p>
                <p className="text-lg font-bold">{isLoadingEarnings ? "—" : earnings?.totals?.gifts ?? 0}</p>
              </div>
              <div className="rounded-xl bg-black/20 p-3 text-center">
                <p className="text-[10px] text-slate-500 uppercase">Tips</p>
                <p className="text-lg font-bold">{isLoadingEarnings ? "—" : earnings?.totals?.tips ?? 0}</p>
              </div>
              <div className="rounded-xl bg-black/20 p-3 text-center">
                <p className="text-[10px] text-slate-500 uppercase">Subs</p>
                <p className="text-lg font-bold">{isLoadingEarnings ? "—" : earnings?.totals?.subscriptions ?? 0}</p>
              </div>
            </div>
            <div className="h-24 flex items-end gap-1 mb-4">
              {(earnings?.chartData ?? [8, 8, 8, 8, 8, 8, 8]).map((h, i) => (
                <div key={i} className="flex-1 bg-violet-500 rounded-t-sm" style={{ height: `${h}%` }} />
              ))}
            </div>
            {earnings?.topGifters?.length ? (
              <div>
                <p className="text-xs font-bold text-slate-400 uppercase mb-2">Top supporters</p>
                <div className="space-y-2">
                  {earnings.topGifters.map((g) => (
                    <div key={g.id} className="flex justify-between text-sm">
                      <span className="text-slate-200">{g.name}</span>
                      <span className="text-violet-300 font-semibold">{g.total} coins</span>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
            {!isLoadingEarnings && earnings?.linkClicks != null ? (
              <p className="text-xs text-slate-500 mt-3">{earnings.linkClicks} bio link clicks (28d)</p>
            ) : null}
          </section>

          <MonetizationSettings />

          {/* Split Section: Demographics & Top Content */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
             {/* Content Manager Preview */}
             <section className="bg-white/5 border border-white/10 p-5 rounded-3xl backdrop-blur-sm flex flex-col">
                <div className="flex justify-between items-end mb-4">
                  <div>
                    <h2 className="text-base font-bold">Content Manager</h2>
                    <p className="text-xs text-slate-400 mt-0.5">Manage uploads & drafts</p>
                  </div>
                  <select value={filter} onChange={(e) => setFilter(e.target.value)} className="bg-white/5 border border-white/10 text-xs text-white rounded-lg px-2 py-1.5 outline-none focus:border-[#3b82f6]">
                    <option value="all">All</option>
                    <option value="draft">Drafts</option>
                    <option value="published">Published</option>
                  </select>
                </div>

                <div className="space-y-3 flex-1 overflow-y-auto hide-scrollbar max-h-64">
                   {isLoadingUploads ? (
                      <p className="text-slate-400 text-xs">Loading...</p>
                   ) : visibleUploads.length === 0 ? (
                      <p className="text-slate-400 text-xs text-center mt-10">No uploads found.</p>
                   ) : (
                      visibleUploads.map((upload) => (
                         <div key={upload.id} className="flex items-center gap-3 p-2 hover:bg-white/5 rounded-xl transition-colors group">
                            <div className="w-12 h-16 bg-slate-800 rounded-md overflow-hidden shrink-0 relative">
                               <img src={upload.media_url || `https://api.dicebear.com/9.x/shapes/svg?seed=${upload.id}`} alt="" className="w-full h-full object-cover opacity-80" />
                            </div>
                            <div className="flex-1 min-w-0">
                               {editingId === upload.id ? (
                                  <div className="flex gap-2">
                                     <InputField value={draftTitle} onChange={(e) => setDraftTitle(e.target.value)} className="h-7 text-xs px-2 w-full" autoFocus />
                                     <PrimaryButton size="sm" className="h-7 text-xs px-3" onClick={saveEdit} disabled={isUpdatingUpload}>Save</PrimaryButton>
                                  </div>
                               ) : (
                                  <>
                                    <p className="font-semibold text-sm text-white truncate">{upload.title}</p>
                                    <p className="text-[10px] text-slate-400 uppercase tracking-wider mt-0.5">{upload.status ?? "draft"} • {upload.visibility}</p>
                                    <div className="flex gap-2 mt-2">
                                      <button onClick={() => startEdit(upload)} className="text-xs text-[#3b82f6] font-semibold hover:underline">Edit</button>
                                      {(upload.status ?? "draft") === "draft" && (
                                        <button 
                                          onClick={async () => {
                                             await publishUpload(upload.id);
                                             toast({ title: "Published!" });
                                          }}
                                          disabled={isPublishingUpload} 
                                          className="text-xs text-emerald-400 font-semibold hover:underline"
                                        >
                                          Publish
                                        </button>
                                      )}
                                    </div>
                                  </>
                               )}
                            </div>
                         </div>
                      ))
                   )}
                </div>
             </section>
          </div>
          <div className="h-10" />
        </div>
      </div>
    </div>
  );
}
