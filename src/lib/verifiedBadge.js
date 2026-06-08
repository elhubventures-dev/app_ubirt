/** Verified creator when both thresholds are met. */
export const VERIFIED_FOLLOWERS = 1000;
export const VERIFIED_POSTS = 10;

export function isVerifiedCreator({ followers = 0, postCount = 0 }) {
  return followers >= VERIFIED_FOLLOWERS && postCount >= VERIFIED_POSTS;
}
