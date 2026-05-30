import { useState } from "react";
import { motion } from "framer-motion";

const AUDIO_TRACKS = [
  { id: "original", name: "Original Sound", author: "You", duration: "0:00" },
  { id: "track1", name: "Lofi Study Beats", author: "Chillhop", duration: "2:45" },
  { id: "track2", name: "Summer Vibes", author: "DJ Pop", duration: "3:10" },
  { id: "track3", name: "Trending TikTok Song", author: "Viral Hits", duration: "1:00" },
];

export function AudioLibrary({ selectedAudio, onSelectAudio }) {
  return (
    <div className="w-full">
      <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3 pl-1">Audio</h3>
      <div className="space-y-2 max-h-[200px] overflow-y-auto hide-scrollbar">
        {AUDIO_TRACKS.map((track) => {
          const isActive = selectedAudio === track.id;
          return (
            <button
              key={track.id}
              onClick={() => onSelectAudio(track.id)}
              className={`w-full flex items-center justify-between p-3 rounded-2xl border transition-colors ${isActive ? 'bg-[#3b82f6]/10 border-[#3b82f6]/50' : 'bg-white/5 border-transparent hover:bg-white/10'}`}
            >
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center ${isActive ? 'bg-[#3b82f6] text-white' : 'bg-slate-800 text-slate-400'}`}>
                  <span className="material-symbols-outlined text-[20px]">music_note</span>
                </div>
                <div className="text-left">
                  <p className={`text-sm font-bold ${isActive ? 'text-[#3b82f6]' : 'text-slate-200'}`}>{track.name}</p>
                  <p className="text-xs text-slate-500">{track.author}</p>
                </div>
              </div>
              <span className="text-xs font-mono text-slate-500">{track.duration}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
