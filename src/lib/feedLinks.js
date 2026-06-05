export function feedPostPath(postId) {
  if (!postId) return "/feed";
  return `/feed?post=${encodeURIComponent(postId)}`;
}
