export default function PullToRefreshIndicator({ offset, refreshing }) {
  if (offset <= 0 && !refreshing) return null;
  return (
    <div
      className="absolute left-0 right-0 flex justify-center pointer-events-none z-30"
      style={{ top: Math.max(48, offset), opacity: offset > 8 || refreshing ? 1 : 0 }}
    >
      <div
        className={`w-8 h-8 rounded-full bg-black/70 border border-white/10 flex items-center justify-center ${refreshing ? "animate-spin" : ""}`}
        style={{ transform: refreshing ? undefined : `rotate(${offset * 3}deg)` }}
      >
        <span className="material-symbols-outlined text-[#3b82f6] text-[18px]">refresh</span>
      </div>
    </div>
  );
}
