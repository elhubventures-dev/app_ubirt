import { cn } from "@/lib/utils";

export function InputField({ className, ...props }) {
  return (
    <input
      className={cn(
        "w-full rounded-lg px-3 py-2 bg-white/10 border border-white/10 text-white placeholder:text-slate-500",
        className
      )}
      {...props}
    />
  );
}
