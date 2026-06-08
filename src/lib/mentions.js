/** @username mention pattern — 2–30 chars, letters, numbers, underscore */
const MENTION_REGEX = /@([a-zA-Z0-9_]{2,30})/g;

export function extractMentionUsernames(text) {
  if (!text) return [];
  const found = new Set();
  for (const match of text.matchAll(MENTION_REGEX)) {
    found.add(match[1].toLowerCase());
  }
  return [...found];
}

export function parseTextWithMentions(text) {
  if (!text) return [{ type: "text", value: "" }];
  const parts = [];
  let lastIndex = 0;
  for (const match of text.matchAll(MENTION_REGEX)) {
    const index = match.index ?? 0;
    if (index > lastIndex) {
      parts.push({ type: "text", value: text.slice(lastIndex, index) });
    }
    parts.push({ type: "mention", value: match[1] });
    lastIndex = index + match[0].length;
  }
  if (lastIndex < text.length) {
    parts.push({ type: "text", value: text.slice(lastIndex) });
  }
  return parts.length ? parts : [{ type: "text", value: text }];
}

export async function resolveMentionUserIds(supabase, usernames, excludeUserId) {
  if (!usernames.length) return [];
  const { data, error } = await supabase
    .from("profiles")
    .select("id, username")
    .in(
      "username",
      usernames.map((u) => u.toLowerCase())
    );
  if (error) throw error;
  return (data ?? []).filter((row) => row.id !== excludeUserId);
}
