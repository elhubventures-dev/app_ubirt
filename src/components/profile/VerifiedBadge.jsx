export default function VerifiedBadge({ className = "" }) {
  return (
    <span
      className={`inline-flex items-center justify-center w-4 h-4 rounded-full bg-[#3b82f6] text-white shrink-0 ${className}`}
      title="Verified creator"
      aria-label="Verified creator"
    >
      <span className="material-symbols-outlined text-[11px] leading-none" style={{ fontVariationSettings: "'FILL' 1" }}>
        verified
      </span>
    </span>
  );
}
