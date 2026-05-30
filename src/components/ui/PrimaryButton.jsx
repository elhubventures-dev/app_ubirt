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
    "inline-block transition-colors disabled:opacity-60",
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
  children,
  ...props
}) {
  return (
    <button
      type={type}
      disabled={disabled}
      className={cn(
        "transition-colors disabled:opacity-60 disabled:cursor-not-allowed",
        variants[variant],
        sizes[size],
        className
      )}
      {...props}
    >
      {children}
    </button>
  );
}
