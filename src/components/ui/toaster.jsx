import { useToast } from "@/components/ui/use-toast";

export function Toaster() {
  const { toasts, dismiss } = useToast();

  return (
    <div className="fixed top-4 right-4 z-[100] space-y-2 w-[320px] max-w-[90vw]">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={`rounded-lg border p-3 shadow-lg backdrop-blur ${
            toast.variant === "destructive"
              ? "bg-red-950/90 border-red-400/40 text-red-100"
              : "bg-slate-900/90 border-white/20 text-white"
          }`}
        >
          <div className="flex items-start justify-between gap-2">
            <div>
              {toast.title && <p className="font-semibold text-sm">{toast.title}</p>}
              {toast.description && <p className="text-xs mt-1 text-slate-200">{toast.description}</p>}
            </div>
            <button type="button" className="text-xs text-slate-300" onClick={() => dismiss(toast.id)}>
              Close
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
