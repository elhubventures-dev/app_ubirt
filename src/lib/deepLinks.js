const APP_HOSTS = new Set(["app.ubirtai.site", "www.app.ubirtai.site", "localhost"]);

/** Map a public URL or custom scheme link to an in-app route. */
export function resolveDeepLink(rawUrl) {
  if (!rawUrl) return null;

  try {
    let url = rawUrl;

    if (url.startsWith("ubirtai.app://")) {
      url = url.replace("ubirtai.app://", "https://app.ubirtai.site/");
    }

    const parsed = new URL(url, "https://app.ubirtai.site");
    const host = parsed.hostname.replace(/^www\./, "");
    const isAppHost = APP_HOSTS.has(parsed.hostname) || APP_HOSTS.has(host);

    if (!isAppHost && !parsed.pathname.startsWith("/")) {
      return null;
    }

    const path = parsed.pathname.replace(/\/+$/, "") || "/";
    const postId = parsed.searchParams.get("post");

    if (path === "/feed" || path.startsWith("/feed/")) {
      return postId ? `/feed?post=${encodeURIComponent(postId)}` : "/feed";
    }

    const userMatch = path.match(/^\/(?:user|u)\/([^/]+)\/?$/);
    if (userMatch) {
      return `/user/${decodeURIComponent(userMatch[1])}`;
    }

    const followersMatch = path.match(/^\/(?:user|u)\/([^/]+)\/followers\/?$/);
    if (followersMatch) {
      return `/user/${decodeURIComponent(followersMatch[1])}/followers`;
    }

    const followingMatch = path.match(/^\/(?:user|u)\/([^/]+)\/following\/?$/);
    if (followingMatch) {
      return `/user/${decodeURIComponent(followingMatch[1])}/following`;
    }

    const soundMatch = path.match(/^\/sound\/([^/]+)\/?$/);
    if (soundMatch) {
      return `/sound/${decodeURIComponent(soundMatch[1])}`;
    }

    const locationMatch = path.match(/^\/explore\/location\/([^/]+)\/?$/);
    if (locationMatch) {
      return `/explore/location/${decodeURIComponent(locationMatch[1])}`;
    }

    const tagMatch = path.match(/^\/tag\/([^/]+)\/?$/);
    if (tagMatch) {
      return `/tag/${decodeURIComponent(tagMatch[1])}`;
    }

    if (path === "/explore") return "/explore";
    if (path === "/messages") return "/messages";
    if (path === "/notifications") return "/notifications";
    if (path === "/search") return "/search";
    if (path === "/wallet") return "/wallet";
    if (path === "/settings") return "/settings";
    if (path === "/" || path === "/home") return "/";

    const chatMatch = path.match(/^\/chat\/([^/]+)\/?$/);
    if (chatMatch) return `/chat/${decodeURIComponent(chatMatch[1])}`;

    const groupMatch = path.match(/^\/group\/([^/]+)\/?$/);
    if (groupMatch) return `/group/${decodeURIComponent(groupMatch[1])}`;

    return null;
  } catch {
    return null;
  }
}

export function profileShareUrl(username) {
  const base = (import.meta.env.VITE_APP_URL || "https://app.ubirtai.site").replace(/\/$/, "");
  return `${base}/u/${encodeURIComponent(username)}`;
}
