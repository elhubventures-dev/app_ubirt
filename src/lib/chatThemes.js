export const CHAT_THEMES = {
  default: {
    id: "default",
    label: "Default",
    page: "bg-[#0a0f16]",
    header: "bg-[#101822]/80",
    footer: "bg-[#0a0f16]",
    meBubble: "bg-[#3b82f6] text-white",
    otherBubble: "bg-[#202938] text-slate-100 border border-white/5",
  },
  midnight: {
    id: "midnight",
    label: "Midnight",
    page: "bg-[#05070d]",
    header: "bg-[#0b0f18]/90",
    footer: "bg-[#05070d]",
    meBubble: "bg-indigo-600 text-white",
    otherBubble: "bg-[#151a28] text-slate-100 border border-white/5",
  },
  ocean: {
    id: "ocean",
    label: "Ocean",
    page: "bg-[#041018]",
    header: "bg-[#0a1a24]/90",
    footer: "bg-[#041018]",
    meBubble: "bg-cyan-600 text-white",
    otherBubble: "bg-[#122432] text-slate-100 border border-cyan-900/40",
  },
  violet: {
    id: "violet",
    label: "Violet",
    page: "bg-[#0c0814]",
    header: "bg-[#151022]/90",
    footer: "bg-[#0c0814]",
    meBubble: "bg-violet-600 text-white",
    otherBubble: "bg-[#1e1630] text-slate-100 border border-violet-900/40",
  },
  forest: {
    id: "forest",
    label: "Forest",
    page: "bg-[#061008]",
    header: "bg-[#0f1a14]/90",
    footer: "bg-[#061008]",
    meBubble: "bg-emerald-600 text-white",
    otherBubble: "bg-[#142018] text-slate-100 border border-emerald-900/40",
  },
};

export const REACTION_EMOJIS = ["❤️", "😂", "👍", "😮", "😢", "🙏", "🔥"];

export function getChatTheme(themeId) {
  return CHAT_THEMES[themeId] ?? CHAT_THEMES.default;
}
