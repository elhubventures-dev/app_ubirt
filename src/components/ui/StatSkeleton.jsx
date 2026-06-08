/** Pulse placeholder for stat numbers while data loads. */
export function StatSkeleton({ className = "h-8 w-16" }) {
  return <div className={`rounded-lg bg-white/10 animate-pulse ${className}`} />;
}
