export default function AppUpdateBanner({ update, onDismiss }) {
  if (!update) return null;

  return (
    <div className="fixed top-[calc(env(safe-area-inset-top)+0.75rem)] left-4 right-4 z-[120] bg-[#1a2332] border border-[#3b82f6]/30 rounded-2xl p-4 shadow-2xl">
      <div className="flex items-start gap-3">
        <span className="material-symbols-outlined text-[#3b82f6] mt-0.5">system_update</span>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-white">Update available</p>
          <p className="text-xs text-slate-400 mt-1">{update.message}</p>
          <p className="text-[10px] text-slate-500 mt-1">
            Installed {update.current} · Latest {update.latest}
          </p>
        </div>
        <button type="button" onClick={onDismiss} className="text-slate-500 hover:text-white p-1">
          <span className="material-symbols-outlined text-[18px]">close</span>
        </button>
      </div>
      {update.storeUrl ? (
        <a
          href={update.storeUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-3 block w-full text-center py-2.5 rounded-xl bg-[#3b82f6] text-white text-sm font-semibold"
        >
          Open store
        </a>
      ) : null}
    </div>
  );
}
