import { cn } from "@/lib/utils";

const heights = {
  sm: "h-12",
  md: "h-16",
  lg: "h-20",
};

export function SkeletonRow({ height = "md", className, count = 1 }) {
  const rows = Array.from({ length: count }, (_, i) => i);

  return (
    <>
      {rows.map((i) => (
        <div
          key={i}
          className={cn(
            "rounded-xl bg-white/5 border border-white/10 animate-pulse",
            heights[height] ?? heights.md,
            className
          )}
        />
      ))}
    </>
  );
}
