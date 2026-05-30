import { useState } from "react";
import { motion } from "framer-motion";

const FILTERS = [
  { id: "none", name: "Normal", class: "" },
  { id: "vibrant", name: "Vibrant", class: "contrast-125 saturate-150" },
  { id: "noir", name: "Noir", class: "grayscale contrast-125" },
  { id: "vintage", name: "Vintage", class: "sepia-[.8] hue-rotate-[-30deg]" },
  { id: "cool", name: "Cool", class: "hue-rotate-15 saturate-110" },
];

export function VideoFilters({ currentFilter, onSelectFilter }) {
  return (
    <div className="w-full">
      <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3 pl-1">Filters</h3>
      <div className="flex gap-3 overflow-x-auto hide-scrollbar pb-2 px-1">
        {FILTERS.map((f) => {
          const isActive = currentFilter === f.id;
          return (
            <button
              key={f.id}
              onClick={() => onSelectFilter(f.id)}
              className="flex flex-col items-center gap-2 group shrink-0"
            >
              <div className={`w-16 h-20 rounded-xl overflow-hidden border-2 transition-colors ${isActive ? 'border-[#3b82f6]' : 'border-transparent group-hover:border-white/20'} bg-slate-800`}>
                <img src="https://images.unsplash.com/photo-1517841905240-472988babdf9?w=200&h=300&fit=crop" alt={f.name} className={`w-full h-full object-cover ${f.class}`} />
              </div>
              <span className={`text-[10px] font-bold tracking-wide ${isActive ? 'text-[#3b82f6]' : 'text-slate-400'}`}>{f.name}</span>
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
