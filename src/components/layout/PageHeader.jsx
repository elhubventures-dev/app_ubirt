import { Link } from "react-router-dom";
import { cn } from "@/lib/utils";

const navButtonClass =
  "relative z-20 min-w-11 min-h-11 flex items-center justify-center text-slate-400 hover:text-white rounded-full bg-white/5 transition-colors shrink-0";

/**
 * Three-column header: back (always tappable) | center | right.
 * Center slot uses pointer-events-none by default so it never blocks nav buttons.
 */
export default function PageHeader({
  onBack,
  backTo,
  backIcon = "arrow_back_ios",
  backLabel = "Go back",
  title,
  center,
  centerInteractive = false,
  right,
  className,
  backClassName,
}) {
  const backControl =
    onBack || backTo ? (
      backTo ? (
        <Link
          to={backTo}
          aria-label={backLabel}
          className={cn(navButtonClass, "text-[#3b82f6] hover:text-[#60a5fa]", backClassName)}
        >
          <span className="material-symbols-outlined text-[24px]">{backIcon}</span>
        </Link>
      ) : (
        <button
          type="button"
          onClick={onBack}
          aria-label={backLabel}
          className={cn(navButtonClass, backClassName)}
        >
          <span className="material-symbols-outlined text-[24px]">{backIcon}</span>
        </button>
      )
    ) : (
      <div className="w-11 h-11 shrink-0" aria-hidden />
    );

  return (
    <header
      className={cn(
        "shrink-0 grid grid-cols-[auto_1fr_auto] items-center gap-2 px-3 pb-3",
        "pt-[calc(env(safe-area-inset-top,0px)+0.75rem)]",
        "bg-[#101822]/80 backdrop-blur-xl border-b border-white/5 z-50 relative",
        className
      )}
    >
      {backControl}
      <div
        className={cn(
          "min-w-0 flex items-center justify-center",
          !centerInteractive && "pointer-events-none"
        )}
      >
        {center ??
          (title ? (
            <h1 className="text-base font-bold tracking-wide truncate text-white">{title}</h1>
          ) : null)}
      </div>
      <div className="relative z-20 flex items-center justify-end min-w-11 shrink-0">
        {right ?? <div className="w-11 h-11" aria-hidden />}
      </div>
    </header>
  );
}
