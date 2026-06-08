/** Skeleton first paint for the reels feed while posts load. */
export default function FeedLoadingShell() {
  return (
    <div className="relative w-full h-[100dvh] bg-black">
      <div className="absolute top-0 left-0 right-0 z-10 pt-12 pb-4 flex justify-center items-start gap-6 bg-gradient-to-b from-black/60 to-transparent">
        <div className="h-6 w-20 rounded-full bg-white/20 animate-pulse" />
        <div className="h-6 w-16 rounded-full bg-white/30 animate-pulse" />
      </div>

      <div className="absolute inset-0 bg-gradient-to-b from-slate-900 via-[#101822] to-black animate-pulse" />

      <div className="absolute right-4 bottom-32 flex flex-col items-center gap-5">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="w-11 h-11 rounded-full bg-white/10 animate-pulse" />
        ))}
      </div>

      <div className="absolute bottom-24 left-4 right-20 space-y-3">
        <div className="h-4 w-32 rounded-full bg-white/15 animate-pulse" />
        <div className="h-3 w-48 rounded-full bg-white/10 animate-pulse" />
        <div className="h-3 w-40 rounded-full bg-white/10 animate-pulse" />
      </div>
    </div>
  );
}
