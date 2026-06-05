export const DEFAULT_COVER_URL =
  "https://images.unsplash.com/photo-1557683311-eac922347aa1?w=800&h=300&fit=crop&q=80";

export function getProfileCoverUrl(cover) {
  return cover || DEFAULT_COVER_URL;
}
