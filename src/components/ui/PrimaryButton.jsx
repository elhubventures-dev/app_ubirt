import { cn } from "@/lib/utils";

const variants = {
  primary: "bg-[#0d5bba] text-white hover:bg-[#0b4e9f]",
  secondary: "bg-white/10 text-slate-200 hover:bg-white/15",
  ghost: "bg-transparent text-slate-300 hover:bg-white/10",
  danger: "bg-red-900 text-red-100 hover:bg-red-800",
};

const sizes = {
  sm: "px-3 py-1.5 text-sm rounded-lg",
  md: "px-4 py-2 text-sm rounded-lg",
};

export function getButtonClasses(variant = "primary", size = "md", className) {
  return cn(
    "inline-block transition-all active:scale-[0.98] disabled:opacity-60 disabled:active:scale-100",
    variants[variant],
    sizes[size],
    className
  );
}

export function PrimaryButton({
  variant = "primary",
  size = "md",
  type = "button",
  className,
  disabled,
  isLoading = false,
  loadingLabel = "Please wait…",
  children,
  ...props
}) {
  return (
    <button
      type={type}
      disabled={disabled || isLoading}
      className={cn(
        "transition-all active:scale-[0.98] disabled:opacity-60 disabled:cursor-not-allowed disabled:active:scale-100",
        variants[variant],
        sizes[size],
        className
      )}
      {...props}
    >
      {isLoading ? (
        <span className="inline-flex items-center justify-center gap-2">
          <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
          {loadingLabel}
        </span>
      ) : (
        children
      )}
    </button>
  );
}
