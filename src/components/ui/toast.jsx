export function Toast({ title, description, variant = "default" }) {
  return (
    <div
      className={`rounded-lg border p-3 ${
        variant === "destructive"
          ? "bg-red-950/90 border-red-400/40 text-red-100"
          : "bg-slate-900/90 border-white/20 text-white"
      }`}
    >
      {title && <p className="font-semibold text-sm">{title}</p>}
      {description && <p className="text-xs mt-1 text-slate-200">{description}</p>}
    </div>
  );
}
