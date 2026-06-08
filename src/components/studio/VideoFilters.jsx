import { motion } from "framer-motion";

export const FILTERS = [
  { id: "none", name: "Normal", class: "" },
  { id: "vibrant", name: "Vibrant", class: "contrast-125 saturate-150" },
  { id: "noir", name: "Noir", class: "grayscale contrast-125" },
  { id: "vintage", name: "Vintage", class: "sepia-[.8] hue-rotate-[-30deg]" },
  { id: "cool", name: "Cool", class: "hue-rotate-15 saturate-110" },
  { id: "warm", name: "Warm", class: "hue-rotate-[-18deg] saturate-125 brightness-105" },
  { id: "fade", name: "Fade", class: "brightness-110 contrast-75 saturate-90" },
  { id: "dramatic", name: "Dramatic", class: "contrast-150 brightness-90 saturate-120" },
  { id: "bright", name: "Bright", class: "brightness-115 saturate-110 contrast-105" },
  { id: "moody", name: "Moody", class: "brightness-75 contrast-110 saturate-80" },
  { id: "sunset", name: "Sunset", class: "sepia-[.35] saturate-150 hue-rotate-[-12deg] brightness-105" },
  { id: "clarity", name: "Clarity", class: "contrast-110 brightness-105 saturate-105" },
  { id: "punch", name: "Punch", class: "contrast-125 saturate-200 brightness-105" },
  { id: "mono", name: "Mono", class: "grayscale brightness-105" },
  { id: "soft", name: "Soft", class: "brightness-108 contrast-90 saturate-95" },
];

const FALLBACK_THUMB =
  "https://images.unsplash.com/photo-1517841905240-472988babdf9?w=200&h=300&fit=crop";

export function VideoFilters({ currentFilter, onSelectFilter, previewSrc }) {
  const thumbSrc = previewSrc || FALLBACK_THUMB;

  return (
    <div className="w-full">
      <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3 pl-1">Filters</h3>
      <div className="flex gap-3 overflow-x-auto hide-scrollbar pb-2 px-1">
        {FILTERS.map((f) => {
          const isActive = currentFilter === f.id;
          return (
            <button
              key={f.id}
              type="button"
              onClick={() => onSelectFilter(f.id)}
              className="flex flex-col items-center gap-2 group shrink-0"
            >
              <div
                className={`w-16 h-20 rounded-xl overflow-hidden border-2 transition-colors bg-black flex items-center justify-center ${
                  isActive ? "border-[#3b82f6]" : "border-transparent group-hover:border-white/20"
                }`}
              >
                <img
                  src={thumbSrc}
                  alt={f.name}
                  className={`max-w-full max-h-full object-contain ${f.class}`}
                />
              </div>
              <span
                className={`text-[10px] font-bold tracking-wide ${isActive ? "text-[#3b82f6]" : "text-slate-400"}`}
              >
                {f.name}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function getFilterClass(filterId) {
  const filter = FILTERS.find((f) => f.id === filterId);
  return filter ? filter.class : "";
}
