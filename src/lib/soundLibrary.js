/** Curated sound tracks for upload + discover search (no backend yet). */
export const SOUND_LIBRARY = [
  { id: "original", name: "Original Sound", author: "You", duration: "0:00" },
  { id: "track1", name: "Lofi Study Beats", author: "Chillhop", duration: "2:45" },
  { id: "track2", name: "Summer Vibes", author: "DJ Pop", duration: "3:10" },
  { id: "track3", name: "Trending TikTok Song", author: "Viral Hits", duration: "1:00" },
  { id: "track4", name: "Night Drive", author: "Synthwave Co.", duration: "2:20" },
  { id: "track5", name: "Acoustic Morning", author: "Indie Room", duration: "1:48" },
];

export function searchSounds(query) {
  const q = query.trim().toLowerCase();
  const browsable = SOUND_LIBRARY.filter((track) => track.id !== "original");
  if (!q) return browsable;
  return browsable.filter(
    (track) =>
      track.name.toLowerCase().includes(q) ||
      track.author.toLowerCase().includes(q) ||
      track.id.toLowerCase().includes(q)
  );
}

export function getSoundById(id) {
  return SOUND_LIBRARY.find((track) => track.id === id) ?? null;
}
