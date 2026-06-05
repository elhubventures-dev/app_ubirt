/** Badge catalog — ids must match `syncAchievementBadges` in supabaseApi.js */
export const ACHIEVEMENT_BADGES = [
  {
    id: "1",
    title: "First Post",
    description: "Published your first post.",
    icon: "rocket_launch",
    color: "from-purple-500 to-indigo-500",
  },
  {
    id: "2",
    title: "Viral Creator",
    description: "Reached 100,000 total views.",
    icon: "local_fire_department",
    color: "from-orange-500 to-red-500",
  },
  {
    id: "3",
    title: "Social Butterfly",
    description: "Left 50 comments.",
    icon: "forum",
    color: "from-blue-400 to-blue-600",
  },
  {
    id: "4",
    title: "Rising Star",
    description: "Gained 100 followers.",
    icon: "group",
    color: "from-emerald-400 to-emerald-600",
  },
  {
    id: "5",
    title: "Fan Favorite",
    description: "Received 10 gifts from fans.",
    icon: "redeem",
    color: "from-pink-500 to-rose-500",
  },
  {
    id: "6",
    title: "Diamond Status",
    description: "Received 100 gifts.",
    icon: "diamond",
    color: "from-cyan-300 to-blue-500",
  },
];

export function mapBadgesWithUnlock(unlockedIds = []) {
  const unlocked = new Set((unlockedIds ?? []).map(String));
  return ACHIEVEMENT_BADGES.map((badge) => ({
    ...badge,
    unlocked: unlocked.has(badge.id),
  }));
}
