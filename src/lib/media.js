export function inferMediaType(mediaUrl, muxPlaybackId) {
  if (muxPlaybackId) return "video";
  if (!mediaUrl) return "image";
  if (/\.(mp4|webm|ogg|mov|m3u8)(\?|$)/i.test(mediaUrl)) return "video";
  if (/stream\.mux\.com/i.test(mediaUrl)) return "video";
  return "image";
}

export function isImagePost(post) {
  if (!post?.media_url) return false;
  if (post.media_type === "image") return true;
  if (post.media_type === "video" && post.mux_playback_id) return false;
  return inferMediaType(post.media_url, post.mux_playback_id) === "image";
}
