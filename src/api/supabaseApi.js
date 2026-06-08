import { getSupabase } from "@/lib/supabaseClient";
import { uploadAvatar, uploadCover, uploadVoiceFile } from "@/api/storage";
import { normalizeNotificationPrefs } from "@/lib/notificationPreferences";
import { getApiUrl } from "@/lib/apiBase";
import { processImageUpload } from "@/lib/videoPipeline";
import { inferMediaType } from "@/lib/media";
import { getNotificationPath } from "@/lib/notificationLinks";
import { sendPushNotification } from "@/lib/sendPush";
import { validateImageFile } from "@/lib/uploadPolicy";
import { extractMentionUsernames, resolveMentionUserIds } from "@/lib/mentions";
import { isVerifiedCreator } from "@/lib/verifiedBadge";
import { SOUND_LIBRARY } from "@/lib/soundLibrary";
import { assertCleanText } from "@/lib/profanityFilter";

async function getUserId() {
  const supabase = getSupabase();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();
  if (error || !user) throw new Error("Not authenticated");
  return user.id;
}

async function getHiddenMessageIds(userId) {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("message_hides")
    .select("message_id")
    .eq("user_id", userId);
  if (error) throw error;
  return new Set((data ?? []).map((row) => row.message_id));
}

function applyHiddenMessageFilter(query, hiddenIds) {
  if (!hiddenIds.size) return query;
  return query.not("id", "in", `(${[...hiddenIds].join(",")})`);
}

async function notifyUser(recipientId, type, text, options = {}) {
  if (!recipientId) return;
  const supabase = getSupabase();
  const actorId = options.actorId ?? (await getUserId());
  const { data: notificationId, error } = await supabase.rpc("create_notification", {
    p_recipient_id: recipientId,
    p_type: type,
    p_text: text,
    p_actor_id: actorId,
    p_post_id: options.postId ?? null,
    p_conversation_id: options.conversationId ?? options.chatId ?? null,
  });
  if (error) throw error;

  const pushData = {
    ...(options.data || {}),
    ...(options.chatId ? { chatId: options.chatId } : {}),
    ...(options.url ? { url: options.url } : {}),
  };

  if (notificationId) {
    await sendPushNotification({
      userId: recipientId,
      notificationId,
      type,
      title: options.title || (type === "message" ? "New message" : "UBIRT"),
      body: text,
      data: Object.keys(pushData).length ? pushData : undefined,
    });
  }

  return notificationId;
}

async function getActorDisplayName(userId) {
  const supabase = getSupabase();
  const { data } = await supabase
    .from("profiles")
    .select("display_name, username")
    .eq("id", userId)
    .maybeSingle();
  return data?.display_name ?? data?.username ?? "Someone";
}

async function notifyMentionedUsers(text, { postId, actorId, skipUserIds = [] }) {
  const usernames = extractMentionUsernames(text);
  if (!usernames.length) return;
  const supabase = getSupabase();
  const actor = actorId ?? (await getUserId());
  const mentioned = await resolveMentionUserIds(supabase, usernames, actor);
  const skip = new Set([actor, ...skipUserIds]);
  const actorName = await getActorDisplayName(actor);
  for (const row of mentioned) {
    if (skip.has(row.id)) continue;
    await notifyUser(row.id, "mention", `${actorName} mentioned you`, { postId, actorId: actor });
  }
}

function mapMessageRow(m, userId, profileMap = {}, extras = {}) {
  const profile = profileMap[m.sender_id];
  const senderName = profile?.display_name ?? profile?.username ?? "Member";
  return {
    id: m.id,
    role: m.sender_id === userId ? "me" : "other",
    senderId: m.sender_id,
    senderName,
    senderAvatar: profile?.avatar_url ?? null,
    text: m.content,
    status: m.status,
    mediaUrl: m.media_url,
    mediaType: m.media_type,
    mediaDuration: m.media_duration ?? null,
    createdAt: m.created_at,
    replyToId: m.reply_to_id ?? null,
    replyTo: extras.replyTo ?? null,
    sharedPostId: m.shared_post_id ?? null,
    sharedPost: extras.sharedPost ?? null,
    reactions: extras.reactions ?? [],
  };
}

function buildReactionSummaries(reactionRows, userId) {
  const byMessage = {};
  for (const row of reactionRows ?? []) {
    if (!byMessage[row.message_id]) byMessage[row.message_id] = {};
    const bucket = byMessage[row.message_id];
    if (!bucket[row.emoji]) {
      bucket[row.emoji] = { emoji: row.emoji, count: 0, mine: false, userIds: [] };
    }
    bucket[row.emoji].count += 1;
    bucket[row.emoji].userIds.push(row.user_id);
    if (row.user_id === userId) bucket[row.emoji].mine = true;
  }
  const result = {};
  for (const [messageId, emojis] of Object.entries(byMessage)) {
    result[messageId] = Object.values(emojis);
  }
  return result;
}

async function enrichMessageRows(supabase, rows, userId, profileMap) {
  if (!rows.length) return [];

  const messageIds = rows.map((r) => r.id);
  const replyIds = [...new Set(rows.map((r) => r.reply_to_id).filter(Boolean))];
  const postIds = [...new Set(rows.map((r) => r.shared_post_id).filter(Boolean))];

  const [reactionsRes, repliesRes, postsRes] = await Promise.all([
    supabase.from("message_reactions").select("message_id, user_id, emoji").in("message_id", messageIds),
    replyIds.length
      ? supabase.from("messages").select("id, content, sender_id, media_type").in("id", replyIds)
      : Promise.resolve({ data: [] }),
    postIds.length
      ? supabase.from("posts").select("id, caption, media_url, user_id").in("id", postIds)
      : Promise.resolve({ data: [] }),
  ]);

  const reactionsByMessage = buildReactionSummaries(reactionsRes.data, userId);
  const replyMap = Object.fromEntries((repliesRes.data ?? []).map((r) => [r.id, r]));
  const postMap = Object.fromEntries((postsRes.data ?? []).map((p) => [p.id, p]));

  const replySenderIds = [...new Set((repliesRes.data ?? []).map((r) => r.sender_id).filter(Boolean))];
  const missingSenderIds = replySenderIds.filter((id) => !profileMap[id]);
  if (missingSenderIds.length) {
    Object.assign(profileMap, await fetchProfilesForSenders(supabase, missingSenderIds));
  }

  return rows.map((m) => {
    const replyRow = m.reply_to_id ? replyMap[m.reply_to_id] : null;
    const replyProfile = replyRow ? profileMap[replyRow.sender_id] : null;
    const replyTo = replyRow
      ? {
          id: replyRow.id,
          text: replyRow.content,
          mediaType: replyRow.media_type,
          senderName: replyProfile?.display_name ?? replyProfile?.username ?? "Member",
        }
      : null;
    const sharedPost = m.shared_post_id ? postMap[m.shared_post_id] ?? null : null;
    return mapMessageRow(m, userId, profileMap, {
      replyTo,
      sharedPost,
      reactions: reactionsByMessage[m.id] ?? [],
    });
  });
}

async function fetchProfilesForSenders(supabase, senderIds) {
  const uniqueIds = [...new Set(senderIds.filter(Boolean))];
  if (!uniqueIds.length) return {};
  const { data } = await supabase
    .from("profiles")
    .select("id, display_name, username, avatar_url")
    .in("id", uniqueIds);
  return Object.fromEntries((data ?? []).map((p) => [p.id, p]));
}

async function callGroupApi(body) {
  const supabase = getSupabase();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  const token = session?.access_token;
  if (!token) throw new Error("Not authenticated");

  const res = await fetch(getApiUrl("/api/conversations/group"), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(body),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(json.error || "Group operation failed");
  }
  return json;
}

function mapPost(row, profile, liked, bookmarked, extras = {}) {
  const hashtags = row.caption?.match(/#[\w]+/g) || [];
  const tags = new Set(hashtags);
  if (row.category) tags.add(`#${row.category.toLowerCase()}`);

  return {
    id: row.id,
    userId: row.user_id,
    author: profile?.display_name ?? "Creator",
    username: profile?.username ?? "user",
    handle: `@${profile?.username ?? "user"}`,
    caption: row.caption,
    tags: Array.from(tags),
    likes: row.likes_count ?? 0,
    comments: row.comments_count ?? 0,
    views: row.views_count ?? 0,
    liked: Boolean(liked),
    bookmarked: Boolean(bookmarked),
    media_url: row.media_url,
    media_type: row.media_type ?? inferMediaType(row.media_url, row.mux_playback_id),
    mux_playback_id: row.mux_playback_id,
    repostOf: row.repost_of ?? null,
    repostCaption: row.repost_caption ?? null,
    originalAuthor: extras.originalAuthor ?? null,
    originalUsername: extras.originalUsername ?? null,
    isPinned: Boolean(extras.isPinned),
    authorVerified: Boolean(extras.authorVerified),
    subscribersOnly: Boolean(row.subscribers_only),
    isPromoted: Boolean(extras.isPromoted),
    locked: Boolean(extras.locked),
    soundId: row.sound_id ?? null,
    locationTag: row.location_tag ?? null,
    coAuthorId: row.co_author_id ?? null,
    coAuthorUsername: extras.coAuthorUsername ?? null,
    coAuthorName: extras.coAuthorName ?? null,
    poll: extras.poll ?? null,
  };
}

async function fetchPollsForPosts(supabase, postIds, userId) {
  if (!postIds.length) return {};
  const { data: polls } = await supabase.from("post_polls").select("id, post_id").in("post_id", postIds);
  if (!polls?.length) return {};

  const pollIds = polls.map((p) => p.id);
  const pollByPost = Object.fromEntries(polls.map((p) => [p.post_id, p.id]));

  const [{ data: options }, { data: votes }] = await Promise.all([
    supabase.from("poll_options").select("id, poll_id, label, votes_count, sort_order").in("poll_id", pollIds),
    userId
      ? supabase.from("poll_votes").select("poll_id, option_id").eq("user_id", userId).in("poll_id", pollIds)
      : Promise.resolve({ data: [] }),
  ]);

  const voteByPoll = Object.fromEntries((votes ?? []).map((v) => [v.poll_id, v.option_id]));
  const optionsByPoll = {};
  for (const opt of options ?? []) {
    if (!optionsByPoll[opt.poll_id]) optionsByPoll[opt.poll_id] = [];
    optionsByPoll[opt.poll_id].push(opt);
  }

  const result = {};
  for (const postId of postIds) {
    const pollId = pollByPost[postId];
    if (!pollId) continue;
    const opts = (optionsByPoll[pollId] ?? []).sort((a, b) => a.sort_order - b.sort_order);
    result[postId] = {
      id: pollId,
      userVoteId: voteByPoll[pollId] ?? null,
      options: opts.map((o) => ({ id: o.id, label: o.label, votes: o.votes_count ?? 0 })),
    };
  }
  return result;
}

async function mapPostsWithExtras(supabase, rows, userId, likedSet, bookmarkedSet, extrasMap = {}) {
  const coAuthorIds = [...new Set(rows.map((r) => r.co_author_id).filter(Boolean))];
  let coAuthorMap = {};
  if (coAuthorIds.length) {
    const { data: coAuthors } = await supabase
      .from("profiles")
      .select("id, username, display_name")
      .in("id", coAuthorIds);
    coAuthorMap = Object.fromEntries((coAuthors ?? []).map((p) => [p.id, p]));
  }

  const pollMap = await fetchPollsForPosts(
    supabase,
    rows.map((r) => r.id),
    userId
  );

  return rows.map((p) => {
    const co = p.co_author_id ? coAuthorMap[p.co_author_id] : null;
    const extra = extrasMap[p.id] ?? {};
    return mapPost(p, p.profiles ?? extra.profile, likedSet.has(p.id), bookmarkedSet.has(p.id), {
      ...extra,
      coAuthorUsername: co?.username ?? null,
      coAuthorName: co?.display_name ?? null,
      poll: pollMap[p.id] ?? null,
    });
  });
}

async function getOrCreateAiConversation(userId) {
  const supabase = getSupabase();
  const { data: existing } = await supabase
    .from("ai_conversations")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (existing) return existing;

  const { data: created, error } = await supabase
    .from("ai_conversations")
    .insert({ user_id: userId, title: "UBIRT Assistant" })
    .select()
    .single();
  if (error) throw error;
  return created;
}

export const supabaseApi = {
  async getFeed(feedType = "foryou", hashtag = null) {
    const userId = await getUserId();
    const supabase = getSupabase();
    
    let query = supabase
      .from("posts")
      .select("*, profiles:user_id (id, username, display_name, avatar_url)")
      .order("created_at", { ascending: false });
      
    if (hashtag) {
      query = query.ilike("caption", `%#${hashtag}%`);
    }

    const { data: posts, error } = await query;
    if (error) throw error;

    const { data: blocks } = await supabase.from("blocked_users").select("blocked_id").eq("blocker_id", userId);
    const blockedIds = new Set((blocks ?? []).map((b) => b.blocked_id));
    
    let filteredPosts = (posts ?? []).filter((p) => !blockedIds.has(p.user_id));
    if (feedType === "following") {
      const { data: follows } = await supabase.from("follows").select("following_id").eq("follower_id", userId);
      const followingIds = new Set((follows || []).map((f) => f.following_id));
      filteredPosts = filteredPosts.filter((p) => p.profiles && followingIds.has(p.profiles.id));
    }

    const repostIds = [...new Set(filteredPosts.filter((p) => p.repost_of).map((p) => p.repost_of))];
    let originalMap = {};
    if (repostIds.length) {
      const { data: originals } = await supabase
        .from("posts")
        .select("id, profiles:user_id (username, display_name)")
        .in("id", repostIds);
      originalMap = Object.fromEntries((originals ?? []).map((o) => [o.id, o.profiles]));
    }

    const creatorIds = [...new Set(filteredPosts.map((p) => p.user_id))];
    const { data: subs } = await supabase
      .from("creator_subscriptions")
      .select("creator_id")
      .eq("subscriber_id", userId)
      .gt("expires_at", new Date().toISOString())
      .in("creator_id", creatorIds.length ? creatorIds : ["00000000-0000-0000-0000-000000000000"]);
    const subscribedCreators = new Set((subs ?? []).map((s) => s.creator_id));

    const postIds = filteredPosts.map((p) => p.id);
    const { data: promos } = postIds.length
      ? await supabase
          .from("post_promotions")
          .select("post_id, boost_score")
          .in("post_id", postIds)
          .gt("expires_at", new Date().toISOString())
      : { data: [] };
    const promoMap = Object.fromEntries((promos ?? []).map((p) => [p.post_id, p.boost_score]));

    const mapped = filteredPosts.map((p) => {
      const original = p.repost_of ? originalMap[p.repost_of] : null;
      const isOwner = p.user_id === userId;
      const isSubscribed = subscribedCreators.has(p.user_id);
      const locked = Boolean(p.subscribers_only) && !isOwner && !isSubscribed;
      return {
        row: p,
        profile: p.profiles,
        extras: {
          originalAuthor: original?.display_name ?? null,
          originalUsername: original?.username ?? null,
          isPromoted: Boolean(promoMap[p.id]),
          locked,
        },
      };
    });

    const { data: likes } = await supabase.from("post_likes").select("post_id").eq("user_id", userId);
    const { data: bookmarks } = await supabase.from("post_bookmarks").select("post_id").eq("user_id", userId);
    const likedSet = new Set((likes ?? []).map((l) => l.post_id));
    const bookmarkedSet = new Set((bookmarks ?? []).map((b) => b.post_id));

    const withPolls = await mapPostsWithExtras(
      supabase,
      mapped.map((m) => m.row),
      userId,
      likedSet,
      bookmarkedSet,
      Object.fromEntries(mapped.map((m) => [m.row.id, m.extras]))
    );

    return withPolls.sort((a, b) => {
      const boostA = promoMap[a.id] ?? 0;
      const boostB = promoMap[b.id] ?? 0;
      if (boostA !== boostB) return boostB - boostA;
      return 0;
    });
  },

  async getFeedPost(postId) {
    const userId = await getUserId();
    const supabase = getSupabase();
    const { data, error } = await supabase
      .from("posts")
      .select("*, profiles:user_id (id, username, display_name, avatar_url)")
      .eq("id", postId)
      .single();
    if (error) throw error;

    const [{ data: like }, { data: bookmark }] = await Promise.all([
      supabase.from("post_likes").select("post_id").eq("user_id", userId).eq("post_id", postId).maybeSingle(),
      supabase.from("post_bookmarks").select("post_id").eq("user_id", userId).eq("post_id", postId).maybeSingle(),
    ]);

    return mapPost(data, data.profiles, Boolean(like), Boolean(bookmark));
  },

  async toggleFollow(username) {
    const supabase = getSupabase();
    const { data: targetProfile } = await supabase.from("profiles").select("id").eq("username", username).single();
    if (!targetProfile) return false;
    const { data, error } = await supabase.rpc("toggle_follow", { p_following_id: targetProfile.id });
    if (error) throw error;
    if (data) {
      const actorId = await getUserId();
      const actorName = await getActorDisplayName(actorId);
      await sendPushNotification({
        userId: targetProfile.id,
        type: "follow",
        title: "New follower",
        body: `${actorName} started following you`,
      });
    }
    return data;
  },
  async isFollowing(username) {
    const userId = await getUserId();
    const supabase = getSupabase();
    const { data: targetProfile } = await supabase.from("profiles").select("id").eq("username", username).single();
    if (!targetProfile) return false;
    const { data } = await supabase.from("follows").select("*").eq("follower_id", userId).eq("following_id", targetProfile.id).maybeSingle();
    return !!data;
  },

  async getFollowers(username) {
    const supabase = getSupabase();
    let viewerId = null;
    try {
      viewerId = await getUserId();
    } catch {
      viewerId = null;
    }

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("id, username, display_name")
      .eq("username", username)
      .maybeSingle();
    if (profileError) throw profileError;
    if (!profile) return [];

    const { data: rows, error } = await supabase
      .from("follows")
      .select("follower_id, profiles:follower_id (id, username, display_name, avatar_url)")
      .eq("following_id", profile.id);
    if (error) throw error;

    let followingSet = new Set();
    if (viewerId) {
      const { data: myFollows } = await supabase
        .from("follows")
        .select("following_id")
        .eq("follower_id", viewerId);
      followingSet = new Set((myFollows ?? []).map((f) => f.following_id));
    }

    return (rows ?? [])
      .map((row) => row.profiles)
      .filter(Boolean)
      .map((p) => ({
        id: p.id,
        username: p.username,
        name: p.display_name ?? p.username,
        avatar: p.avatar_url,
        isFollowing: followingSet.has(p.id),
        isSelf: p.id === viewerId,
      }));
  },

  async getFollowing(username) {
    const supabase = getSupabase();
    let viewerId = null;
    try {
      viewerId = await getUserId();
    } catch {
      viewerId = null;
    }

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("id, username, display_name")
      .eq("username", username)
      .maybeSingle();
    if (profileError) throw profileError;
    if (!profile) return [];

    const { data: rows, error } = await supabase
      .from("follows")
      .select("following_id, profiles:following_id (id, username, display_name, avatar_url)")
      .eq("follower_id", profile.id);
    if (error) throw error;

    let followingSet = new Set();
    if (viewerId) {
      const { data: myFollows } = await supabase
        .from("follows")
        .select("following_id")
        .eq("follower_id", viewerId);
      followingSet = new Set((myFollows ?? []).map((f) => f.following_id));
    }

    return (rows ?? [])
      .map((row) => row.profiles)
      .filter(Boolean)
      .map((p) => ({
        id: p.id,
        username: p.username,
        name: p.display_name ?? p.username,
        avatar: p.avatar_url,
        isFollowing: followingSet.has(p.id),
        isSelf: p.id === viewerId,
      }));
  },

  async getPublicProfile(username) {
    const supabase = getSupabase();
    let viewerId = null;
    try {
      viewerId = await getUserId();
    } catch {
      viewerId = null;
    }

    const { data: profile, error } = await supabase
      .from("profiles")
      .select(
        "id, username, display_name, avatar_url, cover_url, bio, website, location, pinned_post_id, subscription_price_coins, subscription_description, tip_min_coins, paid_dm_price_coins, referral_code"
      )
      .eq("username", username)
      .maybeSingle();
    if (error) throw error;
    if (!profile) return null;

    if (viewerId && viewerId !== profile.id) {
      await supabase.rpc("record_profile_view", { p_profile_id: profile.id }).catch(() => {});
    }

    const [
      { count: followersCount },
      { count: followingCount },
      { data: posts },
      followRow,
      viewCountResult,
      subscriptionRow,
    ] = await Promise.all([
      supabase.from("follows").select("*", { count: "exact", head: true }).eq("following_id", profile.id),
      supabase.from("follows").select("*", { count: "exact", head: true }).eq("follower_id", profile.id),
      supabase
        .from("posts")
        .select("*")
        .eq("user_id", profile.id)
        .order("created_at", { ascending: false }),
      viewerId
        ? supabase
            .from("follows")
            .select("*")
            .eq("follower_id", viewerId)
            .eq("following_id", profile.id)
            .maybeSingle()
        : Promise.resolve({ data: null }),
      viewerId === profile.id
        ? supabase.rpc("get_profile_view_count", { p_profile_id: profile.id, p_days: 28 })
        : Promise.resolve({ data: null }),
      viewerId && viewerId !== profile.id
        ? supabase
            .from("creator_subscriptions")
            .select("expires_at")
            .eq("creator_id", profile.id)
            .eq("subscriber_id", viewerId)
            .gt("expires_at", new Date().toISOString())
            .maybeSingle()
        : Promise.resolve({ data: null }),
    ]);

    const totalLikes = (posts ?? []).reduce((sum, p) => sum + (p.likes_count ?? 0), 0);
    const postCount = posts?.length ?? 0;
    const verified = isVerifiedCreator({ followers: followersCount ?? 0, postCount });
    const pinnedId = profile.pinned_post_id;
    const isSubscribed = Boolean(subscriptionRow?.data);
    const sortedPosts = [...(posts ?? [])].sort((a, b) => {
      if (a.id === pinnedId) return -1;
      if (b.id === pinnedId) return 1;
      return new Date(b.created_at) - new Date(a.created_at);
    });

    return {
      id: profile.id,
      username: profile.username,
      name: profile.display_name ?? profile.username,
      avatar: profile.avatar_url,
      cover: profile.cover_url ?? "",
      bio: profile.bio ?? "",
      website: profile.website ?? "",
      location: profile.location ?? "",
      followers: followersCount ?? 0,
      following: followingCount ?? 0,
      totalLikes,
      verified,
      pinnedPostId: pinnedId,
      profileViews28d: viewerId === profile.id ? viewCountResult?.data ?? 0 : null,
      isFollowing: !!followRow?.data,
      subscriptionPrice: profile.subscription_price_coins ?? null,
      subscriptionDescription: profile.subscription_description ?? "",
      tipMinCoins: profile.tip_min_coins ?? 10,
      paidDmPrice: profile.paid_dm_price_coins ?? null,
      isSubscribed,
      subscriptionExpiresAt: subscriptionRow?.data?.expires_at ?? null,
      posts: sortedPosts.map((p) => {
        const locked = Boolean(p.subscribers_only) && viewerId !== profile.id && !isSubscribed;
        return mapPost(p, profile, false, false, {
          isPinned: p.id === pinnedId,
          authorVerified: verified,
          locked,
        });
      }),
    };
  },

  async getOwnProfile() {
    const userId = await getUserId();
    const supabase = getSupabase();
    const { data, error } = await supabase
      .from("profiles")
      .select("id, username, display_name, avatar_url, cover_url, bio, phone, website, location")
      .eq("id", userId)
      .single();
    if (error) throw error;
    return mapProfileRow(data);
  },

  async getTransactions() {
    const userId = await getUserId();
    const supabase = getSupabase();
    const { data, error } = await supabase
      .from("transactions")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(20);
    if (error) throw error;
    return (data ?? []).map((tx) => ({
      id: tx.id,
      label: "Coin purchase",
      coins: tx.coins_added,
      amount: tx.amount,
      reference: tx.reference,
      time: formatRelative(tx.created_at),
      type: "credit",
    }));
  },

  async getWalletBalance() {
    const userId = await getUserId();
    const supabase = getSupabase();
    const { data, error } = await supabase
      .from("profiles")
      .select("coins, gift_coins")
      .eq("id", userId)
      .single();
    if (error) throw error;
    return {
      platformCoins: data?.coins ?? 0,
      giftCoins: data?.gift_coins ?? 0,
    };
  },

  async convertGiftCoins(amount) {
    const parsedAmount = Math.floor(Number(amount) || 0);
    if (parsedAmount <= 0) {
      throw new Error("Enter a valid amount to convert.");
    }

    const supabase = getSupabase();
    const { data, error } = await supabase.rpc("convert_gift_coins", {
      p_amount: parsedAmount,
    });

    if (error) {
      if (error.message?.includes("convert_gift_coins")) {
        throw new Error("Gift coin conversion is not available yet. Run migration 025 in Supabase.");
      }
      throw error;
    }

    const result = typeof data === "string" ? JSON.parse(data) : data;
    return {
      success: true,
      amount: result.amount ?? parsedAmount,
      platformCoins: result.platform_balance,
      giftCoins: result.gift_balance,
    };
  },

  async getTrendingTags(limit = 6) {
    const supabase = getSupabase();
    const { data: posts } = await supabase
      .from("posts")
      .select("caption, category")
      .order("created_at", { ascending: false })
      .limit(80);

    const counts = {};
    for (const post of posts ?? []) {
      const hashtags = post.caption?.match(/#[\w]+/gi) || [];
      for (const tag of hashtags) {
        const normalized = tag.toLowerCase();
        counts[normalized] = (counts[normalized] ?? 0) + 1;
      }
      if (post.category) {
        const tag = `#${post.category.toLowerCase()}`;
        counts[tag] = (counts[tag] ?? 0) + 1;
      }
    }

    const sorted = Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, limit)
      .map(([tag]) => tag.charAt(0) === "#" ? tag : `#${tag}`);

    return sorted.length ? sorted : ["#Tech", "#Vlog", "#Tutorial", "#Lifestyle", "#Comedy", "#Music"];
  },

  async toggleLike(postId) {
    const userId = await getUserId();
    const supabase = getSupabase();
    const { data: existing, error: readError } = await supabase
      .from("post_likes")
      .select("post_id")
      .eq("post_id", postId)
      .eq("user_id", userId)
      .maybeSingle();
    if (readError) throw readError;

    if (existing) {
      const { error: deleteError } = await supabase
        .from("post_likes")
        .delete()
        .eq("post_id", postId)
        .eq("user_id", userId);
      if (deleteError) throw deleteError;
    } else {
      const { data: post, error: postError } = await supabase
        .from("posts")
        .select("user_id")
        .eq("id", postId)
        .single();
      if (postError) throw postError;

      const { error: insertError } = await supabase
        .from("post_likes")
        .insert({ post_id: postId, user_id: userId });
      if (insertError) throw insertError;

      await supabase.rpc("add_user_xp", { p_user_id: userId, p_amount: 5 });
      const actorName = await getActorDisplayName(userId);
      await notifyUser(post?.user_id, "like", `${actorName} liked your post`, { postId });
    }

    return { id: postId, liked: !existing };
  },

  async toggleBookmark(postId) {
    const userId = await getUserId();
    const supabase = getSupabase();
    const { data: existing, error: readError } = await supabase
      .from("post_bookmarks")
      .select("post_id")
      .eq("post_id", postId)
      .eq("user_id", userId)
      .maybeSingle();
    if (readError) throw readError;

    if (existing) {
      const { error: deleteError } = await supabase
        .from("post_bookmarks")
        .delete()
        .eq("post_id", postId)
        .eq("user_id", userId);
      if (deleteError) throw deleteError;
    } else {
      const { error: insertError } = await supabase
        .from("post_bookmarks")
        .insert({ post_id: postId, user_id: userId });
      if (insertError) throw insertError;
    }

    return { id: postId, bookmarked: !existing };
  },
  async deletePost(postId) {
    const userId = await getUserId();
    const supabase = getSupabase();
    // Only author can delete. Supabase RLS will enforce this if configured.
    const { error } = await supabase.from("posts").delete().eq("id", postId).eq("user_id", userId);
    if (error) throw error;
    return true;
  },

  async sendGift(postId, amount) {
    const supabase = getSupabase();
    const giftAmount = Math.floor(Number(amount) || 0);
    if (giftAmount <= 0) {
      throw new Error("Invalid gift amount.");
    }

    const { data, error } = await supabase.rpc("send_gift", {
      p_post_id: postId,
      p_amount: giftAmount,
    });

    if (error) {
      if (error.message?.includes("send_gift")) {
        throw new Error("Gift transfers are not available yet. Run migration 011 in Supabase.");
      }
      throw error;
    }

    const result = typeof data === "string" ? JSON.parse(data) : data;

    if (result?.receiver_id) {
      await sendPushNotification({
        userId: result.receiver_id,
        type: "gift",
        title: "Gift received!",
        body: `You received ${result.receiver_amount} coins from a gift.`,
      });
    }

    return {
      success: true,
      amount: result.amount ?? giftAmount,
      receiverAmount: result.receiver_amount,
      platformFee: result.platform_fee,
      senderBalance: result.sender_balance,
      receiverGiftBalance: result.receiver_gift_balance,
      receiverId: result.receiver_id,
    };
  },

  async getCreatorAnalytics(days = 28) {
    const userId = await getUserId();
    const supabase = getSupabase();
    const since = new Date();
    since.setDate(since.getDate() - days);
    const prevSince = new Date(since);
    prevSince.setDate(prevSince.getDate() - days);

    const { count: followers } = await supabase
      .from("follows")
      .select("*", { count: "exact", head: true })
      .eq("following_id", userId);
    const { data: posts } = await supabase
      .from("posts")
      .select("views_count, likes_count, created_at")
      .eq("user_id", userId)
      .gte("created_at", since.toISOString());
    const { data: prevPosts } = await supabase
      .from("posts")
      .select("views_count")
      .eq("user_id", userId)
      .gte("created_at", prevSince.toISOString())
      .lt("created_at", since.toISOString());
    const views = (posts ?? []).reduce((sum, p) => sum + (p.views_count ?? 0), 0);
    const prevViews = (prevPosts ?? []).reduce((sum, p) => sum + (p.views_count ?? 0), 0);
    const { data: profile } = await supabase
      .from("profiles")
      .select("gift_coins")
      .eq("id", userId)
      .single();

    const chartDays = Math.min(days, 7);
    const chartData = [];
    for (let i = chartDays - 1; i >= 0; i -= 1) {
      const dayStart = new Date();
      dayStart.setHours(0, 0, 0, 0);
      dayStart.setDate(dayStart.getDate() - i);
      const dayEnd = new Date(dayStart);
      dayEnd.setDate(dayEnd.getDate() + 1);
      const dayViews = (posts ?? [])
        .filter((p) => {
          const created = new Date(p.created_at);
          return created >= dayStart && created < dayEnd;
        })
        .reduce((sum, p) => sum + (p.views_count ?? 0), 0);
      chartData.push(dayViews);
    }
    const maxChart = Math.max(...chartData, 1);

    return {
      followers: followers ?? 0,
      views,
      completionRate: Math.min(100, 40 + (posts?.length ?? 0) * 5),
      earnings: profile?.gift_coins ?? 0,
      chartData: chartData.map((v) => Math.max(8, Math.round((v / maxChart) * 100))),
      growthPct: prevViews > 0 ? Math.round(((views - prevViews) / prevViews) * 100) : views > 0 ? 100 : 0,
    };
  },

  async search(query, options = {}) {
    const q = query.trim();
    if (!q) return { users: [], posts: [], tags: [] };

    const supabase = getSupabase();
    const userId = await getUserId();

    let postsQuery = supabase
      .from("posts")
      .select("*, profiles:user_id (username, display_name, avatar_url)")
      .ilike("caption", `%${q}%`)
      .limit(20);

    if (options.sort === "likes") postsQuery = postsQuery.order("likes_count", { ascending: false });
    else if (options.sort === "views") postsQuery = postsQuery.order("views_count", { ascending: false });
    else postsQuery = postsQuery.order("created_at", { ascending: false });

    if (options.since) postsQuery = postsQuery.gte("created_at", options.since);

    const [{ data: postsRaw }, { data: usersRaw }] = await Promise.all([
      postsQuery,
      supabase
        .from("profiles")
        .select("id, username, display_name, avatar_url")
        .or(`username.ilike.%${q}%,display_name.ilike.%${q}%`)
        .neq("id", userId)
        .limit(10),
    ]);

    const { data: likes } = await supabase.from("post_likes").select("post_id").eq("user_id", userId);
    const likedSet = new Set((likes ?? []).map((l) => l.post_id));

    const posts = (postsRaw ?? []).map((p) => mapPost(p, p.profiles, likedSet.has(p.id), false));
    const users = (usersRaw ?? []).map((u) => ({
      id: u.id,
      username: u.username,
      name: u.display_name ?? u.username,
      avatar: u.avatar_url,
    }));
    const tags = [
      ...new Set((postsRaw ?? []).flatMap((p) => p.caption?.match(/#[\w]+/g) || [])),
    ].slice(0, 5);

    return { users, posts, tags };
  },

  async getSuggestedCreators(limit = 4) {
    const userId = await getUserId();
    const supabase = getSupabase();
    const { data: following } = await supabase
      .from("follows")
      .select("following_id")
      .eq("follower_id", userId);
    const exclude = new Set([userId, ...(following ?? []).map((f) => f.following_id)]);

    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, username, display_name, avatar_url")
      .limit(40);

    const candidates = (profiles ?? []).filter((p) => !exclude.has(p.id)).slice(0, 20);
    const withCounts = await Promise.all(
      candidates.map(async (p) => {
        const { count } = await supabase
          .from("follows")
          .select("*", { count: "exact", head: true })
          .eq("following_id", p.id);
        return { ...p, followers: count ?? 0 };
      })
    );

    return withCounts
      .sort((a, b) => b.followers - a.followers)
      .slice(0, limit)
      .map((u) => ({
        id: u.id,
        username: u.username,
        name: u.display_name ?? u.username,
        avatar: u.avatar_url,
        followers: u.followers,
      }));
  },

  async getTrendingPosts(limit = 20) {
    const userId = await getUserId();
    const supabase = getSupabase();
    const since = new Date();
    since.setDate(since.getDate() - 7);

    const { data: posts, error } = await supabase
      .from("posts")
      .select("*, profiles:user_id (id, username, display_name, avatar_url)")
      .gte("created_at", since.toISOString())
      .order("views_count", { ascending: false })
      .limit(limit * 2);
    if (error) throw error;

    const sorted = [...(posts ?? [])].sort(
      (a, b) =>
        (b.views_count ?? 0) + (b.likes_count ?? 0) * 3 - ((a.views_count ?? 0) + (a.likes_count ?? 0) * 3)
    );

    const { data: likes } = await supabase.from("post_likes").select("post_id").eq("user_id", userId);
    const { data: bookmarks } = await supabase.from("post_bookmarks").select("post_id").eq("user_id", userId);
    const likedSet = new Set((likes ?? []).map((l) => l.post_id));
    const bookmarkedSet = new Set((bookmarks ?? []).map((b) => b.post_id));

    const mapped = await mapPostsWithExtras(supabase, sorted.slice(0, limit), userId, likedSet, bookmarkedSet);
    return mapped;
  },

  async getExploreFeed() {
    const supabase = getSupabase();
    const [trendingPosts, trendingTags] = await Promise.all([
      this.getTrendingPosts(12),
      this.getTrendingTags(8),
    ]);

    const since = new Date();
    since.setDate(since.getDate() - 30);

    const { data: recentPosts } = await supabase
      .from("posts")
      .select("sound_id, location_tag")
      .gte("created_at", since.toISOString());

    const soundCounts = {};
    const locationCounts = {};
    for (const p of recentPosts ?? []) {
      if (p.sound_id) soundCounts[p.sound_id] = (soundCounts[p.sound_id] ?? 0) + 1;
      if (p.location_tag) locationCounts[p.location_tag] = (locationCounts[p.location_tag] ?? 0) + 1;
    }

    const soundTrends = Object.entries(soundCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([id, postCount]) => {
        const meta = SOUND_LIBRARY.find((s) => s.id === id);
        return { id, name: meta?.name ?? id, author: meta?.author ?? "UBIRT", postCount };
      });

    const locationTags = Object.entries(locationCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([tag, count]) => ({ tag, count }));

    return { trendingPosts, trendingTags, soundTrends, locationTags };
  },

  async getPostsBySound(soundId) {
    const userId = await getUserId();
    const supabase = getSupabase();
    const { data, error } = await supabase
      .from("posts")
      .select("*, profiles:user_id (username, display_name, avatar_url)")
      .eq("sound_id", soundId)
      .order("created_at", { ascending: false })
      .limit(40);
    if (error) throw error;
    const { data: likes } = await supabase.from("post_likes").select("post_id").eq("user_id", userId);
    const likedSet = new Set((likes ?? []).map((l) => l.post_id));
    return mapPostsWithExtras(supabase, data ?? [], userId, likedSet, new Set());
  },

  async getPostsByLocation(locationTag) {
    const userId = await getUserId();
    const supabase = getSupabase();
    const { data, error } = await supabase
      .from("posts")
      .select("*, profiles:user_id (username, display_name, avatar_url)")
      .eq("location_tag", locationTag)
      .order("created_at", { ascending: false })
      .limit(40);
    if (error) throw error;
    const { data: likes } = await supabase.from("post_likes").select("post_id").eq("user_id", userId);
    const likedSet = new Set((likes ?? []).map((l) => l.post_id));
    return mapPostsWithExtras(supabase, data ?? [], userId, likedSet, new Set());
  },

  async votePoll(postId, optionId) {
    const supabase = getSupabase();
    const { data, error } = await supabase.rpc("vote_poll", {
      p_post_id: postId,
      p_option_id: optionId,
    });
    if (error) throw error;
    return typeof data === "string" ? JSON.parse(data) : data;
  },

  async getProfileQuestions(profileId) {
    const supabase = getSupabase();
    const { data, error } = await supabase
      .from("profile_questions")
      .select("*, asker:asker_id (username, display_name)")
      .eq("profile_id", profileId)
      .order("created_at", { ascending: false })
      .limit(50);
    if (error) throw error;
    return (data ?? []).map((q) => ({
      id: q.id,
      question: q.question,
      answer: q.answer,
      answeredAt: q.answered_at,
      askerName: q.asker?.display_name ?? q.asker?.username ?? "User",
      askerUsername: q.asker?.username ?? null,
    }));
  },

  async submitProfileQuestion(profileId, question) {
    await assertCleanText(question, "Question");
    const supabase = getSupabase();
    const { data, error } = await supabase.rpc("submit_profile_question", {
      p_profile_id: profileId,
      p_question: question,
    });
    if (error) throw error;
    return data;
  },

  async answerProfileQuestion(questionId, answer) {
    await assertCleanText(answer, "Answer");
    const supabase = getSupabase();
    const { error } = await supabase.rpc("answer_profile_question", {
      p_question_id: questionId,
      p_answer: answer,
    });
    if (error) throw error;
    return true;
  },

  async getComments(postId) {
    const userId = await getUserId();
    const supabase = getSupabase();
    const { data, error } = await supabase
      .from("comments")
      .select("*, profiles:user_id (display_name)")
      .eq("post_id", postId)
      .order("created_at", { ascending: true });
    if (error) throw error;
    return (data ?? []).map((c) => ({
      id: c.id,
      author: c.profiles?.display_name ?? "User",
      authorId: c.user_id,
      text: c.text,
      isMine: c.user_id === userId,
    }));
  },

  async addComment(postId, text) {
    await assertCleanText(text, "Comment");
    const userId = await getUserId();
    const supabase = getSupabase();
    const { data, error } = await supabase
      .from("comments")
      .insert({ post_id: postId, user_id: userId, text })
      .select()
      .single();
    if (error) throw error;

    const { data: post, error: postError } = await supabase
      .from("posts")
      .select("user_id")
      .eq("id", postId)
      .single();
    if (postError) throw postError;

    await supabase.rpc("add_user_xp", { p_user_id: userId, p_amount: 10 });
    const actorName = await getActorDisplayName(userId);
    await notifyUser(post?.user_id, "comment", `${actorName} commented on your post`, { postId });
    await notifyMentionedUsers(text, { postId, actorId: userId, skipUserIds: [post?.user_id] });
    return { id: data.id, author: actorName, text: data.text, isMine: true };
  },

  async getConversation(chatId) {
    const userId = await getUserId();
    const supabase = getSupabase();
    const { data: conv, error: convError } = await supabase
      .from("conversations")
      .select("id, title, type, invite_code, avatar_url, created_by")
      .eq("id", chatId)
      .single();
    if (convError) throw convError;

    const { data: myProfile } = await supabase
      .from("profiles")
      .select("show_read_receipts")
      .eq("id", userId)
      .maybeSingle();

    const { data: members, error } = await supabase
      .from("conversation_members")
      .select(
        "user_id, role, joined_at, last_read_at, chat_theme, archived_at, muted_until, profiles:user_id (display_name, username, avatar_url, last_seen_at, show_read_receipts)"
      )
      .eq("conversation_id", chatId);
    if (error) throw error;

    const memberRows = members ?? [];
    const myMembership = memberRows.find((m) => m.user_id === userId);
    const isGroup = conv.type === "group";
    const mutedUntil = myMembership?.muted_until ?? null;
    const isMuted = mutedUntil ? new Date(mutedUntil).getTime() > Date.now() : false;
    const membershipMeta = {
      chatTheme: myMembership?.chat_theme ?? "default",
      archivedAt: myMembership?.archived_at ?? null,
      mutedUntil,
      isMuted,
      showReadReceipts: myProfile?.show_read_receipts !== false,
    };

    if (isGroup) {
      const canManage = myMembership?.role === "owner" || myMembership?.role === "admin";
      return {
        id: chatId,
        type: "group",
        name: conv.title ?? "Group",
        avatar: conv.avatar_url ?? null,
        memberCount: memberRows.length,
        myRole: myMembership?.role ?? "member",
        canManage,
        inviteCode: canManage ? conv.invite_code : null,
        members: memberRows.map((m) => ({
          id: m.user_id,
          name: m.profiles?.display_name ?? m.profiles?.username ?? "Member",
          username: m.profiles?.username ?? null,
          avatar: m.profiles?.avatar_url ?? null,
          role: m.role,
          joinedAt: m.joined_at,
        })),
        memberReads: memberRows
          .filter((m) => m.user_id !== userId)
          .map((m) => ({
            userId: m.user_id,
            lastReadAt: m.profiles?.show_read_receipts === false ? null : m.last_read_at,
            showReadReceipts: m.profiles?.show_read_receipts !== false,
          })),
        ...membershipMeta,
      };
    }

    const otherMember = memberRows.find((m) => m.user_id !== userId);
    const otherProfile = otherMember?.profiles;

    return {
      id: chatId,
      type: "direct",
      peerId: otherMember?.user_id ?? null,
      name: otherProfile?.display_name ?? otherProfile?.username ?? conv.title ?? "Chat",
      username: otherProfile?.username ?? null,
      avatar: otherProfile?.avatar_url ?? null,
      lastSeenAt: otherProfile?.last_seen_at ?? null,
      peerLastReadAt:
        otherProfile?.show_read_receipts === false ? null : otherMember?.last_read_at ?? null,
      peerShowReadReceipts: otherProfile?.show_read_receipts !== false,
      ...membershipMeta,
    };
  },

  async updateLastSeen() {
    const userId = await getUserId();
    const supabase = getSupabase();
    const { error } = await supabase
      .from("profiles")
      .update({ last_seen_at: new Date().toISOString() })
      .eq("id", userId);
    if (error) throw error;
    return true;
  },

  async getConversations(options = {}) {
    const { includeArchived = false } = options;
    const userId = await getUserId();
    const supabase = getSupabase();
    const { data: memberships, error } = await supabase
      .from("conversation_members")
      .select("conversation_id, last_read_at, archived_at, muted_until, conversations(*)")
      .eq("user_id", userId);
    if (error) throw error;

    const rows = (memberships ?? []).filter((row) =>
      includeArchived ? Boolean(row.archived_at) : !row.archived_at
    );
    const hiddenIds = await getHiddenMessageIds(userId);
    const results = [];
    for (const row of rows) {
      const conv = row.conversations;
      if (!conv) continue;

      const { data: members } = await supabase
        .from("conversation_members")
        .select("user_id, profiles:user_id (display_name, username, avatar_url, last_seen_at)")
        .eq("conversation_id", conv.id);

      const memberRows = members ?? [];
      const isGroup = conv.type === "group";
      const otherMember = memberRows.find((m) => m.user_id !== userId);
      const otherProfile = otherMember?.profiles;

      let lastMsgQuery = supabase
        .from("messages")
        .select("content, created_at, sender_id, media_type, shared_post_id")
        .eq("conversation_id", conv.id)
        .order("created_at", { ascending: false })
        .limit(20);
      lastMsgQuery = applyHiddenMessageFilter(lastMsgQuery, hiddenIds);
      const { data: recentMsgs } = await lastMsgQuery;
      const lastMsg = (recentMsgs ?? [])[0] ?? null;

      const readAfter = row.last_read_at ?? "1970-01-01T00:00:00.000Z";
      let unreadQuery = supabase
        .from("messages")
        .select("id", { count: "exact", head: true })
        .eq("conversation_id", conv.id)
        .neq("sender_id", userId)
        .gt("created_at", readAfter);
      unreadQuery = applyHiddenMessageFilter(unreadQuery, hiddenIds);
      const { count: unreadCount, error: unreadError } = await unreadQuery;
      if (unreadError) throw unreadError;

      const sortAt = lastMsg?.created_at ?? conv.updated_at ?? conv.created_at;

      let lastMessagePreview = "No messages yet";
      if (lastMsg?.shared_post_id) {
        lastMessagePreview = "Shared a post";
      } else if (lastMsg?.media_type === "audio") {
        lastMessagePreview = "Voice message";
      } else if (lastMsg?.content) {
        lastMessagePreview = lastMsg.content;
      }
      if (isGroup && lastMsg && lastMsg.sender_id !== userId) {
        const senderProfile = memberRows.find((m) => m.user_id === lastMsg.sender_id)?.profiles;
        const senderName = senderProfile?.display_name ?? senderProfile?.username ?? "Member";
        lastMessagePreview = `${senderName}: ${lastMessagePreview}`;
      }

      const mutedUntil = row.muted_until ?? null;
      const isMuted = mutedUntil ? new Date(mutedUntil).getTime() > Date.now() : false;

      results.push({
        id: conv.id,
        type: isGroup ? "group" : "direct",
        name: isGroup
          ? conv.title ?? "Group"
          : otherProfile?.display_name ?? otherProfile?.username ?? conv.title ?? "Conversation",
        avatar: isGroup ? conv.avatar_url ?? null : otherProfile?.avatar_url ?? null,
        memberCount: isGroup ? memberRows.length : undefined,
        lastMessage: lastMessagePreview,
        updatedAt: formatRelative(sortAt),
        sortAt,
        unread: unreadCount ?? 0,
        archived: Boolean(row.archived_at),
        isMuted,
      });
    }

    return results.sort((a, b) => new Date(b.sortAt).getTime() - new Date(a.sortAt).getTime());
  },

  async markConversationRead(chatId) {
    const userId = await getUserId();
    const supabase = getSupabase();
    const { error } = await supabase
      .from("conversation_members")
      .update({ last_read_at: new Date().toISOString() })
      .eq("conversation_id", chatId)
      .eq("user_id", userId);
    if (error) throw error;
    return true;
  },

  async startConversation(targetUserId) {
    const userId = await getUserId();
    if (targetUserId === userId) {
      throw new Error("You cannot message yourself.");
    }
    const supabase = getSupabase();

    const { data: convId, error: rpcError } = await supabase.rpc("create_direct_conversation", {
      p_other_user_id: targetUserId,
    });

    if (!rpcError && convId) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("display_name, username, avatar_url")
        .eq("id", targetUserId)
        .single();

      return {
        id: convId,
        name: profile?.display_name ?? profile?.username ?? "Chat",
        avatar: profile?.avatar_url ?? null,
      };
    }

    const {
      data: { session },
    } = await supabase.auth.getSession();
    const token = session?.access_token;
    if (!token) {
      throw new Error(rpcError?.message || "Not authenticated");
    }

    const res = await fetch(getApiUrl("/api/conversations/start"), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ targetUserId }),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(json.error || rpcError?.message || "Failed to start conversation");
    }
    return json;
  },

  async createGroupConversation(title, memberIds = []) {
    const supabase = getSupabase();
    const { data: convId, error: rpcError } = await supabase.rpc("create_group_conversation", {
      p_title: title,
      p_member_ids: memberIds,
    });

    if (!rpcError && convId) {
      return this.getConversation(convId);
    }

    const json = await callGroupApi({ action: "create", title, memberIds });
    return {
      id: json.id,
      type: "group",
      name: json.name,
      avatar: null,
      memberCount: 1 + memberIds.length,
      myRole: "owner",
      canManage: true,
      inviteCode: json.inviteCode,
      members: [],
    };
  },

  async joinGroupViaInvite(inviteCode) {
    const supabase = getSupabase();
    const { data: convId, error: rpcError } = await supabase.rpc("join_group_via_invite", {
      p_invite_code: inviteCode,
    });

    if (!rpcError && convId) {
      return this.getConversation(convId);
    }

    const json = await callGroupApi({ action: "join", inviteCode });
    return {
      id: json.id,
      type: "group",
      name: json.name,
      avatar: null,
      memberCount: undefined,
      myRole: "member",
      canManage: false,
      inviteCode: null,
      members: [],
    };
  },

  async addGroupMembers(conversationId, memberIds) {
    const supabase = getSupabase();
    const { error: rpcError } = await supabase.rpc("add_group_members", {
      p_conversation_id: conversationId,
      p_member_ids: memberIds,
    });
    if (!rpcError) return true;
    await callGroupApi({ action: "addMembers", conversationId, memberIds });
    return true;
  },

  async updateGroupMemberRole(conversationId, userId, role) {
    const supabase = getSupabase();
    const { error: rpcError } = await supabase.rpc("update_group_member_role", {
      p_conversation_id: conversationId,
      p_user_id: userId,
      p_role: role,
    });
    if (!rpcError) return true;
    await callGroupApi({ action: "updateRole", conversationId, userId, role });
    return true;
  },

  async removeGroupMember(conversationId, userId) {
    const supabase = getSupabase();
    const { error: rpcError } = await supabase.rpc("remove_group_member", {
      p_conversation_id: conversationId,
      p_user_id: userId,
    });
    if (!rpcError) return true;
    await callGroupApi({ action: "removeMember", conversationId, userId });
    return true;
  },

  async regenerateGroupInvite(conversationId) {
    const supabase = getSupabase();
    const { data: inviteCode, error } = await supabase.rpc("regenerate_group_invite", {
      p_conversation_id: conversationId,
    });
    if (!error && inviteCode) return inviteCode;
    throw new Error(error?.message || "Failed to regenerate invite link");
  },

  async getMessages(chatId) {
    const userId = await getUserId();
    const supabase = getSupabase();
    const hiddenIds = await getHiddenMessageIds(userId);
    let query = supabase
      .from("messages")
      .select("*")
      .eq("conversation_id", chatId)
      .order("created_at", { ascending: true });
    query = applyHiddenMessageFilter(query, hiddenIds);
    const { data, error } = await query;
    if (error) throw error;
    const rows = data ?? [];
    const profileMap = await fetchProfilesForSenders(
      supabase,
      rows.map((m) => m.sender_id)
    );
    return enrichMessageRows(supabase, rows, userId, profileMap);
  },

  async searchMessages(chatId, query) {
    const q = query?.trim();
    if (!q || q.length < 2) return [];
    const userId = await getUserId();
    const supabase = getSupabase();
    const hiddenIds = await getHiddenMessageIds(userId);
    let dbQuery = supabase
      .from("messages")
      .select("*")
      .eq("conversation_id", chatId)
      .ilike("content", `%${q}%`)
      .order("created_at", { ascending: false })
      .limit(40);
    dbQuery = applyHiddenMessageFilter(dbQuery, hiddenIds);
    const { data, error } = await dbQuery;
    if (error) throw error;
    const rows = data ?? [];
    const profileMap = await fetchProfilesForSenders(
      supabase,
      rows.map((m) => m.sender_id)
    );
    return enrichMessageRows(supabase, rows, userId, profileMap);
  },

  async getChatTyping(chatId) {
    return false;
  },

  subscribeToMessages(chatId, handlers) {
    const onInsert = typeof handlers === "function" ? handlers : handlers?.onInsert;
    const onDelete = typeof handlers === "function" ? undefined : handlers?.onDelete;
    const supabase = getSupabase();
    const userIdPromise = getUserId();
    const channel = supabase.channel(`messages:${chatId}`);

    if (onInsert) {
      channel.on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
          filter: `conversation_id=eq.${chatId}`,
        },
        async (payload) => {
          const userId = await userIdPromise;
          const m = payload.new;
          const profileMap = await fetchProfilesForSenders(supabase, [m.sender_id]);
          const [enriched] = await enrichMessageRows(supabase, [m], userId, profileMap);
          onInsert(enriched);
        }
      );
    }

    if (onDelete) {
      channel.on(
        "postgres_changes",
        {
          event: "DELETE",
          schema: "public",
          table: "messages",
          filter: `conversation_id=eq.${chatId}`,
        },
        (payload) => {
          if (payload.old?.id) onDelete(payload.old.id);
        }
      );
    }

    channel.subscribe((status, err) => {
      if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
        console.error(`messages:${chatId} subscription ${status}`, err);
      }
    });
    return () => supabase.removeChannel(channel);
  },

  async deleteMessage(messageId, scope = "me") {
    const userId = await getUserId();
    const supabase = getSupabase();

    if (scope === "everyone") {
      const { error } = await supabase
        .from("messages")
        .delete()
        .eq("id", messageId)
        .eq("sender_id", userId);
      if (error) throw error;
      return { scope: "everyone" };
    }

    const { error } = await supabase.from("message_hides").upsert(
      { message_id: messageId, user_id: userId },
      { onConflict: "message_id,user_id", ignoreDuplicates: true }
    );
    if (error) throw error;
    return { scope: "me" };
  },

  subscribeToPresence(chatId, onPresenceChange) {
    const supabase = getSupabase();
    let disposed = false;
    let channel = null;

    getUserId().then(async (userId) => {
      if (disposed) return;

      channel = supabase.channel(`presence:${chatId}`, {
        config: { presence: { key: userId } },
      });

      channel.on("presence", { event: "sync" }, () => {
        if (!disposed) onPresenceChange(channel.presenceState());
      });

      channel.subscribe(async (status) => {
        if (disposed || status !== "SUBSCRIBED") return;
        const { data: profile } = await supabase
          .from("profiles")
          .select("username, display_name")
          .eq("id", userId)
          .single();
        await channel.track({ user_id: userId, profile });
      });
    });

    return () => {
      disposed = true;
      if (channel) {
        channel.untrack().finally(() => {
          supabase.removeChannel(channel);
        });
      }
    };
  },

  async updateTypingStatus(chatId, isTyping) {
    const supabase = getSupabase();
    const channel = supabase.channel(`presence:${chatId}`);
    const userId = await getUserId();
    if (isTyping) {
      await channel.track({ typing: true, user_id: userId });
    } else {
      await channel.track({ typing: false, user_id: userId });
    }
  },

  subscribeToReadReceipts(chatId, onUpdate) {
    const supabase = getSupabase();
    const channel = supabase
      .channel(`read-receipts:${chatId}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "conversation_members",
          filter: `conversation_id=eq.${chatId}`,
        },
        () => onUpdate?.()
      )
      .subscribe();
    return () => supabase.removeChannel(channel);
  },

  subscribeToMessageReactions(chatId, onChange) {
    const supabase = getSupabase();
    const channel = supabase
      .channel(`reactions:${chatId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "message_reactions" },
        () => onChange?.()
      )
      .subscribe();
    return () => supabase.removeChannel(channel);
  },

  async toggleMessageReaction(messageId, emoji) {
    const userId = await getUserId();
    const supabase = getSupabase();
    const { data: existing } = await supabase
      .from("message_reactions")
      .select("emoji")
      .eq("message_id", messageId)
      .eq("user_id", userId)
      .maybeSingle();

    if (existing?.emoji === emoji) {
      const { error } = await supabase
        .from("message_reactions")
        .delete()
        .eq("message_id", messageId)
        .eq("user_id", userId);
      if (error) throw error;
      return { removed: true, emoji };
    }

    const { error } = await supabase.from("message_reactions").upsert(
      { message_id: messageId, user_id: userId, emoji },
      { onConflict: "message_id,user_id" }
    );
    if (error) throw error;
    return { removed: false, emoji };
  },

  async setConversationMuted(chatId, hours) {
    const userId = await getUserId();
    const supabase = getSupabase();
    const mutedUntil =
      hours > 0 ? new Date(Date.now() + hours * 60 * 60 * 1000).toISOString() : null;
    const { error } = await supabase
      .from("conversation_members")
      .update({ muted_until: mutedUntil })
      .eq("conversation_id", chatId)
      .eq("user_id", userId);
    if (error) throw error;
    return { mutedUntil };
  },

  async setConversationArchived(chatId, archived = true) {
    const userId = await getUserId();
    const supabase = getSupabase();
    const { error } = await supabase
      .from("conversation_members")
      .update({ archived_at: archived ? new Date().toISOString() : null })
      .eq("conversation_id", chatId)
      .eq("user_id", userId);
    if (error) throw error;
    return { archived };
  },

  async updateChatTheme(chatId, theme) {
    const userId = await getUserId();
    const supabase = getSupabase();
    const { error } = await supabase
      .from("conversation_members")
      .update({ chat_theme: theme })
      .eq("conversation_id", chatId)
      .eq("user_id", userId);
    if (error) throw error;
    return { theme };
  },

  async updateShowReadReceipts(show) {
    const userId = await getUserId();
    const supabase = getSupabase();
    const { error } = await supabase
      .from("profiles")
      .update({ show_read_receipts: show })
      .eq("id", userId);
    if (error) throw error;
    return { showReadReceipts: show };
  },

  async getShowReadReceipts() {
    const userId = await getUserId();
    const supabase = getSupabase();
    const { data, error } = await supabase
      .from("profiles")
      .select("show_read_receipts")
      .eq("id", userId)
      .maybeSingle();
    if (error) throw error;
    return data?.show_read_receipts !== false;
  },

  async sendMessage(chatId, text, attachment, options = {}) {
    const userId = await getUserId();
    const supabase = getSupabase();
    const { replyToId, sharedPostId } = options;
    let content = text?.trim() ?? "";
    let mediaUrl = null;
    let mediaType = null;

    let mediaDuration = null;
    if (attachment?.type === "audio" && attachment.file) {
      const uploaded = await uploadVoiceFile(attachment.file, userId, chatId);
      mediaUrl = uploaded.publicUrl;
      mediaType = "audio";
      if (attachment.durationMs > 0) {
        mediaDuration = Math.max(1, Math.round(attachment.durationMs / 100) / 10);
      }
      if (!content) content = "Voice message";
    } else if (attachment) {
      throw new Error("Only voice messages are supported as attachments right now.");
    }

    if (sharedPostId && !content) {
      content = "Shared a post";
    }

    if (!content && !mediaUrl && !sharedPostId) {
      throw new Error("Message cannot be empty.");
    }

    if (content) {
      await assertCleanText(content, "Message");
    }

    const { data, error } = await supabase
      .from("messages")
      .insert({
        conversation_id: chatId,
        sender_id: userId,
        content,
        media_url: mediaUrl,
        media_type: mediaType,
        media_duration: mediaDuration,
        status: "sent",
        reply_to_id: replyToId ?? null,
        shared_post_id: sharedPostId ?? null,
      })
      .select()
      .single();
    if (error) throw error;
    await supabase.from("conversations").update({ updated_at: new Date().toISOString() }).eq("id", chatId);

    const actorName = await getActorDisplayName(userId);
    const preview = sharedPostId
      ? "Shared a post"
      : mediaType === "audio"
        ? "Voice message"
        : content.length > 80
          ? `${content.slice(0, 77)}...`
          : content;
    const { data: convMeta } = await supabase
      .from("conversations")
      .select("type")
      .eq("id", chatId)
      .maybeSingle();
    const chatPath = convMeta?.type === "group" ? `/group/${chatId}` : `/chat/${chatId}`;

    const { data: members } = await supabase
      .from("conversation_members")
      .select("user_id, muted_until")
      .eq("conversation_id", chatId)
      .neq("user_id", userId);

    for (const member of members ?? []) {
      if (member.muted_until && new Date(member.muted_until).getTime() > Date.now()) {
        continue;
      }
      try {
        await notifyUser(member.user_id, "message", `${actorName}: ${preview}`, {
          chatId,
          conversationId: chatId,
          url: chatPath,
        });
      } catch (notifyError) {
        console.warn("Failed to notify message recipient:", notifyError);
      }
    }

    const profileMap = await fetchProfilesForSenders(supabase, [userId]);
    const [enriched] = await enrichMessageRows(supabase, [data], userId, profileMap);
    return enriched;
  },

  async getAiMessages() {
    const userId = await getUserId();
    const conv = await getOrCreateAiConversation(userId);
    const supabase = getSupabase();
    const { data, error } = await supabase
      .from("ai_messages")
      .select("*")
      .eq("conversation_id", conv.id)
      .order("created_at", { ascending: true });
    if (error) throw error;
    return (data ?? []).map((m) => ({ id: m.id, role: m.role, text: m.text }));
  },

  async getAiConversationMeta() {
    const userId = await getUserId();
    const conv = await getOrCreateAiConversation(userId);
    return { title: conv.title };
  },

  async renameAiConversation(title) {
    const userId = await getUserId();
    const conv = await getOrCreateAiConversation(userId);
    const supabase = getSupabase();
    const { data, error } = await supabase
      .from("ai_conversations")
      .update({ title })
      .eq("id", conv.id)
      .select()
      .single();
    if (error) throw error;
    return { title: data.title };
  },

  async deleteComment(postId, commentId) {
    const userId = await getUserId();
    const supabase = getSupabase();
    const { error } = await supabase
      .from("comments")
      .delete()
      .eq("id", commentId)
      .eq("post_id", postId)
      .eq("user_id", userId);
    if (error) throw error;
  },

  async analyzeCommentToxicity(text) {
    try {
      const res = await fetch(getApiUrl("/api/ai/moderate"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ input: text }),
      });
      if (!res.ok) throw new Error("Moderation API failed");
      const json = await res.json();
      return json.flagged ?? false;
    } catch (e) {
      console.warn("Toxicity check failed, falling back to basic check:", e);
      // Fallback if API fails or key is missing
      const toxicWords = ["hate", "stupid", "idiot", "ugly"];
      return toxicWords.some(word => text.toLowerCase().includes(word));
    }
  },

  async deleteAiMessage(messageId) {
    const supabase = getSupabase();
    const { error } = await supabase.from("ai_messages").delete().eq("id", messageId);
    if (error) throw error;
    return true;
  },

  async updateDeviceToken(token, meta = {}) {
    const userId = await getUserId();
    const supabase = getSupabase();
    const platform = meta.platform ?? "unknown";
    const provider = meta.provider ?? (platform === "ios" ? "apns" : "fcm");

    const [{ error: upsertError }, { error: profileError }] = await Promise.all([
      supabase.from("push_tokens").upsert(
        {
          user_id: userId,
          token,
          platform,
          provider,
          enabled: true,
          last_seen_at: new Date().toISOString(),
        },
        { onConflict: "token" }
      ),
      // Legacy fallback for older sender paths.
      supabase.from("profiles").update({ device_token: token }).eq("id", userId),
    ]);
    if (upsertError) throw upsertError;
    if (profileError) throw profileError;
    console.log("Device token updated in Supabase:", token, platform, provider);
    return true;
  },

  async clearAiConversation() {
    const userId = await getUserId();
    const conv = await getOrCreateAiConversation(userId);
    const supabase = getSupabase();
    await supabase.from("ai_messages").delete().eq("conversation_id", conv.id);
    const { data } = await supabase
      .from("ai_messages")
      .insert({
        conversation_id: conv.id,
        role: "assistant",
        text: "Hi. I can help with scripts, hooks, and UX copy.",
      })
      .select();
    return (data ?? []).map((m) => ({ id: m.id, role: m.role, text: m.text }));
  },

  async askAi(prompt) {
    const userId = await getUserId();
    const conv = await getOrCreateAiConversation(userId);
    const supabase = getSupabase();

    const { data: userMsg, error: userErr } = await supabase
      .from("ai_messages")
      .insert({ conversation_id: conv.id, role: "user", text: prompt })
      .select()
      .single();
    if (userErr) throw userErr;

    let assistantText;
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const res = await fetch(getApiUrl("/api/ai/chat"), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
        },
        body: JSON.stringify({ prompt }),
      });
      if (!res.ok) throw new Error("AI API unavailable");
      const json = await res.json();
      assistantText = json.reply;
    } catch {
      assistantText = `Draft response for: "${prompt}". (Connect OPENAI_API_KEY on Vercel for live AI.)`;
    }

    const { data: botMsg, error: botErr } = await supabase
      .from("ai_messages")
      .insert({ conversation_id: conv.id, role: "assistant", text: assistantText })
      .select()
      .single();
    if (botErr) throw botErr;

    return {
      userMsg: { id: userMsg.id, role: "user", text: userMsg.text },
      botMsg: { id: botMsg.id, role: "assistant", text: botMsg.text },
    };
  },

  async retryLastAiResponse() {
    const messages = await this.getAiMessages();
    const lastUser = [...messages].reverse().find((m) => m.role === "user");
    if (!lastUser) return null;
    const { botMsg } = await this.askAi(lastUser.text);
    return botMsg;
  },

  async getCreatorStats() {
    const userId = await getUserId();
    const supabase = getSupabase();
    const [{ count: followers }, { count: following }] = await Promise.all([
      supabase.from("follows").select("*", { count: "exact", head: true }).eq("following_id", userId),
      supabase.from("follows").select("*", { count: "exact", head: true }).eq("follower_id", userId),
    ]);
    const { data: posts } = await supabase
      .from("posts")
      .select("views_count, likes_count")
      .eq("user_id", userId);
    const views = (posts ?? []).reduce((sum, p) => sum + (p.views_count ?? 0), 0);
    const totalLikes = (posts ?? []).reduce((sum, p) => sum + (p.likes_count ?? 0), 0);
    const { data: uploads } = await supabase.from("uploads").select("id").eq("user_id", userId);
    return {
      views,
      followers: followers ?? 0,
      following: following ?? 0,
      totalLikes,
      completionRate: Math.min(100, 40 + (uploads?.length ?? 0) * 5),
    };
  },

  async saveUpload(payload, file = null) {
    const userId = await getUserId();
    if (payload.title) await assertCleanText(payload.title, "Title");
    if (payload.description) await assertCleanText(payload.description, "Description");
    if (payload.locationTag) await assertCleanText(payload.locationTag, "Location");
    let mediaUrl = null;
    let storagePath = null;
    let muxAssetId = null;
    let muxPlaybackId = null;

    if (file) {
      const processed = await processImageUpload(file, userId);
      mediaUrl = processed.mediaUrl;
      storagePath = processed.storagePath;
      muxAssetId = processed.muxAssetId;
      muxPlaybackId = processed.muxPlaybackId;
    }

    const supabase = getSupabase();
    const { data, error } = await supabase
      .from("uploads")
      .insert({
        user_id: userId,
        title: payload.title,
        description: payload.description,
        category: payload.category,
        visibility: payload.visibility,
        status: "draft",
        storage_path: storagePath,
        media_url: mediaUrl,
        mux_asset_id: muxAssetId,
        mux_playback_id: muxPlaybackId,
        sound_id: payload.audio && payload.audio !== "original" ? payload.audio : null,
        location_tag: payload.locationTag?.trim() || null,
        co_author_username: payload.coAuthorUsername?.trim()?.replace(/^@/, "") || null,
        poll_options:
          Array.isArray(payload.pollOptions) && payload.pollOptions.filter(Boolean).length >= 2
            ? payload.pollOptions.filter(Boolean).slice(0, 4)
            : null,
      })
      .select()
      .single();
    if (error) throw error;
    return { id: data.id, ...payload, media_url: mediaUrl };
  },

  async getUploads() {
    const userId = await getUserId();
    const supabase = getSupabase();
    const { data, error } = await supabase
      .from("uploads")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });
    if (error) throw error;
    return data ?? [];
  },

  async updateUpload(uploadId, patch) {
    const userId = await getUserId();
    const supabase = getSupabase();
    const { data: before } = await supabase
      .from("uploads")
      .select("media_url, status")
      .eq("id", uploadId)
      .eq("user_id", userId)
      .single();

    const { data, error } = await supabase
      .from("uploads")
      .update(patch)
      .eq("id", uploadId)
      .eq("user_id", userId)
      .select()
      .single();
    if (error) throw error;

    if (before?.status === "published" && before.media_url) {
      const caption = data.description || data.title || "";
      await supabase
        .from("posts")
        .update({ caption })
        .eq("user_id", userId)
        .eq("media_url", before.media_url);
    }
    return data;
  },

  async deleteUpload(uploadId) {
    const userId = await getUserId();
    const supabase = getSupabase();
    const { data: upload, error: fetchError } = await supabase
      .from("uploads")
      .select("media_url")
      .eq("id", uploadId)
      .eq("user_id", userId)
      .single();
    if (fetchError) throw fetchError;

    if (upload?.media_url) {
      const { error: postError } = await supabase
        .from("posts")
        .delete()
        .eq("user_id", userId)
        .eq("media_url", upload.media_url);
      if (postError) throw postError;
    }

    const { error: deleteError } = await supabase
      .from("uploads")
      .delete()
      .eq("id", uploadId)
      .eq("user_id", userId);
    if (deleteError) throw deleteError;
    return true;
  },

  async publishUpload(uploadId) {
    return this.updateUpload(uploadId, { status: "published" });
  },

  async getNotifications() {
    const userId = await getUserId();
    const supabase = getSupabase();
    const { data, error } = await supabase
      .from("notifications")
      .select("*, actor:actor_id (username, display_name, avatar_url)")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });
    if (error) throw error;
    return (data ?? []).map((n) => ({
      id: n.id,
      type: n.type,
      text: n.text,
      time: formatRelative(n.created_at),
      read: n.read ?? false,
      actorId: n.actor_id ?? null,
      actorUsername: n.actor?.username ?? null,
      postId: n.post_id ?? null,
      conversationId: n.conversation_id ?? null,
    }));
  },

  async findDirectConversationWithUser(nameOrUsername) {
    const userId = await getUserId();
    const supabase = getSupabase();
    let profile = null;
    const { data: byName } = await supabase
      .from("profiles")
      .select("id")
      .eq("display_name", nameOrUsername)
      .maybeSingle();
    profile = byName;
    if (!profile?.id) {
      const { data: byUsername } = await supabase
        .from("profiles")
        .select("id")
        .eq("username", nameOrUsername)
        .maybeSingle();
      profile = byUsername;
    }
    if (!profile?.id) return null;

    const { data: memberships } = await supabase
      .from("conversation_members")
      .select("conversation_id")
      .eq("user_id", userId);
    const conversationIds = (memberships ?? []).map((row) => row.conversation_id);
    if (!conversationIds.length) return null;

    const { data: peers } = await supabase
      .from("conversation_members")
      .select("conversation_id")
      .eq("user_id", profile.id)
      .in("conversation_id", conversationIds)
      .limit(1)
      .maybeSingle();

    return peers?.conversation_id ?? null;
  },

  async resolveNotificationLink(item) {
    const type = String(item?.type || "").toLowerCase();
    if (type === "message" && item.conversationId) {
      const supabase = getSupabase();
      const { data: conv } = await supabase
        .from("conversations")
        .select("type")
        .eq("id", item.conversationId)
        .maybeSingle();
      if (conv?.type === "group") return `/group/${item.conversationId}`;
      return `/chat/${item.conversationId}`;
    }

    const directPath = getNotificationPath(item);
    if (directPath) return directPath;

    const supabase = getSupabase();

    const lookupUsername = async (name) => {
      const { data: byName } = await supabase
        .from("profiles")
        .select("username")
        .eq("display_name", name)
        .maybeSingle();
      if (byName?.username) return byName.username;
      const { data: byUsername } = await supabase
        .from("profiles")
        .select("username")
        .eq("username", name)
        .maybeSingle();
      return byUsername?.username ?? null;
    };

    if (type === "follow") {
      const name = item.text?.replace(/ started following you$/i, "").trim();
      if (name) {
        const username = await lookupUsername(name);
        if (username) return `/user/${username}`;
      }
    }

    if (type === "message") {
      const name = item.text?.split(":")[0]?.trim();
      if (name) {
        const conversationId = await this.findDirectConversationWithUser(name);
        if (conversationId) return `/chat/${conversationId}`;
        const username = await lookupUsername(name);
        if (username) return `/user/${username}`;
      }
    }

    if (["like", "comment", "gift"].includes(type)) {
      return "/feed";
    }

    return null;
  },

  async markNotificationRead(notificationId) {
    const userId = await getUserId();
    const supabase = getSupabase();
    const { error } = await supabase
      .from("notifications")
      .update({ read: true })
      .eq("id", notificationId)
      .eq("user_id", userId);
    if (error) throw error;
    return true;
  },

  async markAllNotificationsRead() {
    const userId = await getUserId();
    const supabase = getSupabase();
    const { error } = await supabase
      .from("notifications")
      .update({ read: true })
      .eq("user_id", userId)
      .eq("read", false);
    if (error) throw error;
    return true;
  },

  async createPostFromUpload(uploadId) {
    const userId = await getUserId();
    const supabase = getSupabase();
    const { data: upload } = await supabase.from("uploads").select("*").eq("id", uploadId).single();
    if (!upload) throw new Error("Upload not found");

    let coAuthorId = null;
    if (upload.co_author_username) {
      const { data: coAuthor } = await supabase
        .from("profiles")
        .select("id")
        .eq("username", upload.co_author_username.toLowerCase())
        .maybeSingle();
      coAuthorId = coAuthor?.id ?? null;
    }

    const { data, error } = await supabase
      .from("posts")
      .insert({
        user_id: userId,
        caption: upload.description || upload.title,
        media_url: upload.media_url,
        media_type: inferMediaType(upload.media_url, upload.mux_playback_id),
        category: (upload.category ?? "general").toLowerCase(),
        mux_asset_id: upload.mux_asset_id,
        mux_playback_id: upload.mux_playback_id,
        sound_id: upload.sound_id ?? null,
        location_tag: upload.location_tag ?? null,
        co_author_id: coAuthorId,
      })
      .select()
      .single();
    if (error) throw error;

    const pollOptions = upload.poll_options;
    if (Array.isArray(pollOptions) && pollOptions.filter(Boolean).length >= 2) {
      await supabase.rpc("create_post_poll", {
        p_post_id: data.id,
        p_options: pollOptions.filter(Boolean).slice(0, 4),
      });
    }

    await supabase.rpc("add_user_xp", { p_user_id: userId, p_amount: 50 });
    const caption = upload.description || upload.title || "";
    await notifyMentionedUsers(caption, { postId: data.id, actorId: userId });
    if (coAuthorId && coAuthorId !== userId) {
      const actorName = await getActorDisplayName(userId);
      await notifyUser(coAuthorId, "mention", `${actorName} tagged you as co-creator on a post`, {
        postId: data.id,
      });
    }
    return data;
  },

  async getAchievements() {
    const userId = await getUserId();
    const supabase = getSupabase();
    const { data: profile } = await supabase.from("profiles").select("xp, level").eq("id", userId).single();
    const xp = profile?.xp ?? 0;
    const level = profile?.level ?? 1;

    const [
      { count: commentCount },
      { count: uploadCount },
      { count: followers },
      { count: giftCount },
      { data: posts },
    ] = await Promise.all([
      supabase.from("comments").select("*", { count: "exact", head: true }).eq("user_id", userId),
      supabase.from("uploads").select("*", { count: "exact", head: true }).eq("user_id", userId).eq("status", "published"),
      supabase.from("follows").select("*", { count: "exact", head: true }).eq("following_id", userId),
      supabase.from("gifts").select("*", { count: "exact", head: true }).eq("receiver_id", userId),
      supabase.from("posts").select("views_count").eq("user_id", userId),
    ]);

    const views = (posts ?? []).reduce((sum, p) => sum + (p.views_count ?? 0), 0);
    await syncAchievementBadges(supabase, {
      uploadCount: uploadCount ?? 0,
      commentCount: commentCount ?? 0,
      followers: followers ?? 0,
      giftCount: giftCount ?? 0,
      views,
    });

    const { data: unlocked } = await supabase.from("user_achievements").select("badge_id").eq("user_id", userId);
    const quests = [
      {
        id: "upload",
        title: "Publish a Post",
        progress: Math.min(uploadCount ?? 0, 1),
        total: 1,
        reward: 100,
        completed: (uploadCount ?? 0) >= 1,
      },
      {
        id: "comments",
        title: "Leave 3 Comments",
        progress: Math.min(commentCount ?? 0, 3),
        total: 3,
        reward: 30,
        completed: (commentCount ?? 0) >= 3,
      },
      {
        id: "views",
        title: "Reach 1,000 Views",
        progress: Math.min(views, 1000),
        total: 1000,
        reward: 50,
        completed: views >= 1000,
      },
    ];

    return {
      xp,
      level,
      xpForNextLevel: xpForLevel(level),
      xpProgress: xpProgress(xp, level),
      badges: (unlocked ?? []).map((u) => u.badge_id),
      quests,
    };
  },

  async recordVideoView(postId) {
    const supabase = getSupabase();
    await supabase.rpc("increment_post_views", { p_post_id: postId });
  },

  async updateProfile({ name, username, bio, phone, website, location, avatarFile, coverFile }) {
    const userId = await getUserId();
    const supabase = getSupabase();

    const normalizedUsername = String(username || "")
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9_]/g, "");
    if (!normalizedUsername) {
      throw new Error("Username is required.");
    }

    const updates = {
      display_name: String(name || "").trim() || normalizedUsername,
      username: normalizedUsername,
      bio: String(bio || "").trim() || null,
      phone: String(phone || "").trim() || null,
      website: String(website || "").trim() || null,
      location: String(location || "").trim() || null,
    };
    if (avatarFile) {
      updates.avatar_url = await uploadAvatar(avatarFile, userId);
    }
    if (coverFile) {
      updates.cover_url = await uploadCover(coverFile, userId);
    }

    const { data, error } = await supabase
      .from("profiles")
      .update(updates)
      .eq("id", userId)
      .select()
      .single();
    if (error) {
      if (error.code === "23505") {
        throw new Error("That username is already taken.");
      }
      throw error;
    }
    return mapProfileRow(data);
  },

  async getBlockedUserIds() {
    const userId = await getUserId();
    const supabase = getSupabase();
    const { data, error } = await supabase.from("blocked_users").select("blocked_id").eq("blocker_id", userId);
    if (error) throw error;
    return (data ?? []).map((row) => row.blocked_id);
  },

  async blockUser(blockedId) {
    const userId = await getUserId();
    if (blockedId === userId) throw new Error("You cannot block yourself.");
    const supabase = getSupabase();
    const { error } = await supabase.from("blocked_users").upsert(
      { blocker_id: userId, blocked_id: blockedId },
      { onConflict: "blocker_id,blocked_id" }
    );
    if (error) throw error;
    return true;
  },

  async unblockUser(blockedId) {
    const userId = await getUserId();
    const supabase = getSupabase();
    const { error } = await supabase
      .from("blocked_users")
      .delete()
      .eq("blocker_id", userId)
      .eq("blocked_id", blockedId);
    if (error) throw error;
    return true;
  },

  async isUserBlocked(blockedId) {
    const userId = await getUserId();
    const supabase = getSupabase();
    const { data, error } = await supabase
      .from("blocked_users")
      .select("id")
      .eq("blocker_id", userId)
      .eq("blocked_id", blockedId)
      .maybeSingle();
    if (error) throw error;
    return Boolean(data);
  },

  async submitReport({ targetType, targetId, reason, details }) {
    const userId = await getUserId();
    const supabase = getSupabase();
    const { error } = await supabase.from("reports").insert({
      reporter_id: userId,
      target_type: targetType,
      target_id: String(targetId),
      reason,
      details: details || null,
    });
    if (error) throw error;
    return true;
  },

  async getNotificationPreferences() {
    const userId = await getUserId();
    const supabase = getSupabase();
    const { data, error } = await supabase
      .from("profiles")
      .select("notification_preferences")
      .eq("id", userId)
      .single();
    if (error) throw error;
    return normalizeNotificationPrefs(data?.notification_preferences);
  },

  async updateNotificationPreferences(prefs) {
    const userId = await getUserId();
    const supabase = getSupabase();
    const normalized = normalizeNotificationPrefs(prefs);
    const { error } = await supabase
      .from("profiles")
      .update({ notification_preferences: normalized })
      .eq("id", userId);
    if (error) throw error;
    return normalized;
  },

  async requestWithdrawal({ amount, payoutMethod, payoutDetails }) {
    const supabase = getSupabase();
    const { data, error } = await supabase.rpc("request_gift_coin_withdrawal", {
      p_amount: amount,
      p_payout_method: payoutMethod,
      p_payout_details: payoutDetails ?? {},
    });
    if (error) throw error;
    return data;
  },

  async getWithdrawalRequests() {
    const userId = await getUserId();
    const supabase = getSupabase();
    const { data, error } = await supabase
      .from("withdrawal_requests")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(20);
    if (error) throw error;
    return (data ?? []).map((row) => ({
      id: row.id,
      amount: row.amount,
      payoutMethod: row.payout_method,
      status: row.status,
      createdAt: row.created_at,
      adminNote: row.admin_note,
    }));
  },

  async updateGroupAvatar(conversationId, avatarFile) {
    validateImageFile(avatarFile);
    const userId = await getUserId();
    const avatarUrl = await uploadAvatar(avatarFile, userId);
    const supabase = getSupabase();
    const { error } = await supabase
      .from("conversations")
      .update({ avatar_url: avatarUrl })
      .eq("id", conversationId);
    if (error) throw error;
    return avatarUrl;
  },

  async repostPost(postId, repostCaption = "") {
    const userId = await getUserId();
    const supabase = getSupabase();
    const { data: original, error: fetchError } = await supabase
      .from("posts")
      .select("*")
      .eq("id", postId)
      .single();
    if (fetchError || !original) throw new Error("Post not found");

    const caption = String(repostCaption || "").trim() || original.caption;
    const { data, error } = await supabase
      .from("posts")
      .insert({
        user_id: userId,
        caption,
        media_url: original.media_url,
        media_type: original.media_type,
        category: original.category,
        mux_asset_id: original.mux_asset_id,
        mux_playback_id: original.mux_playback_id,
        repost_of: original.id,
        repost_caption: String(repostCaption || "").trim() || null,
      })
      .select("*, profiles:user_id (id, username, display_name, avatar_url)")
      .single();
    if (error) throw error;

    const { data: origProfile } = await supabase
      .from("profiles")
      .select("username, display_name")
      .eq("id", original.user_id)
      .single();

    await notifyMentionedUsers(caption, { postId: data.id, actorId: userId, skipUserIds: [original.user_id] });
    if (original.user_id !== userId) {
      const actorName = await getActorDisplayName(userId);
      await notifyUser(original.user_id, "repost", `${actorName} reposted your post`, { postId: data.id });
    }

    return mapPost(data, data.profiles, false, false, {
      originalAuthor: origProfile?.display_name,
      originalUsername: origProfile?.username,
    });
  },

  async pinPost(postId) {
    const userId = await getUserId();
    const supabase = getSupabase();
    const { data: post } = await supabase.from("posts").select("id").eq("id", postId).eq("user_id", userId).maybeSingle();
    if (!post) throw new Error("Post not found or not yours.");
    const { error } = await supabase.from("profiles").update({ pinned_post_id: postId }).eq("id", userId);
    if (error) throw error;
    return true;
  },

  async unpinPost() {
    const userId = await getUserId();
    const supabase = getSupabase();
    const { error } = await supabase.from("profiles").update({ pinned_post_id: null }).eq("id", userId);
    if (error) throw error;
    return true;
  },

  async getPostIdForUpload(uploadId) {
    const userId = await getUserId();
    const supabase = getSupabase();
    const { data: upload } = await supabase.from("uploads").select("media_url, status").eq("id", uploadId).eq("user_id", userId).maybeSingle();
    if (!upload?.media_url || upload.status !== "published") return null;
    const { data: post } = await supabase
      .from("posts")
      .select("id")
      .eq("user_id", userId)
      .eq("media_url", upload.media_url)
      .maybeSingle();
    return post?.id ?? null;
  },

  async getCreatorEarnings(days = 28) {
    const userId = await getUserId();
    const supabase = getSupabase();
    const since = new Date();
    since.setDate(since.getDate() - days);

    const [
      { data: gifts },
      { data: tips },
      { data: subs },
      { data: conversions },
      { count: linkClicks },
      { data: profile },
    ] = await Promise.all([
      supabase
        .from("gifts")
        .select("amount, receiver_amount, created_at, sender_id, profiles:sender_id (display_name, username)")
        .eq("receiver_id", userId)
        .gte("created_at", since.toISOString())
        .order("created_at", { ascending: false }),
      supabase
        .from("creator_tips")
        .select("amount, receiver_amount, tip_type, created_at, sender_id, profiles:sender_id (display_name, username)")
        .eq("receiver_id", userId)
        .gte("created_at", since.toISOString())
        .order("created_at", { ascending: false }),
      supabase
        .from("creator_subscriptions")
        .select("price_paid, created_at, subscriber_id, profiles:subscriber_id (display_name, username)")
        .eq("creator_id", userId)
        .gte("created_at", since.toISOString())
        .order("created_at", { ascending: false }),
      supabase
        .from("wallet_conversions")
        .select("amount, created_at")
        .eq("user_id", userId)
        .gte("created_at", since.toISOString())
        .order("created_at", { ascending: false }),
      supabase
        .from("profile_link_clicks")
        .select("*", { count: "exact", head: true })
        .eq("profile_id", userId)
        .gte("created_at", since.toISOString()),
      supabase.from("profiles").select("gift_coins, referral_code").eq("id", userId).single(),
    ]);

    const giftTotal = (gifts ?? []).reduce((s, g) => s + (g.receiver_amount ?? 0), 0);
    const tipTotal = (tips ?? []).reduce((s, t) => s + (t.receiver_amount ?? 0), 0);
    const subTotal = (subs ?? []).reduce((s, t) => s + Math.floor((t.price_paid ?? 0) * 0.8), 0);

    const gifterMap = {};
    for (const g of gifts ?? []) {
      const key = g.sender_id;
      if (!gifterMap[key]) {
        gifterMap[key] = {
          id: key,
          name: g.profiles?.display_name ?? g.profiles?.username ?? "Fan",
          total: 0,
        };
      }
      gifterMap[key].total += g.receiver_amount ?? 0;
    }
    for (const t of tips ?? []) {
      const key = t.sender_id;
      if (!gifterMap[key]) {
        gifterMap[key] = {
          id: key,
          name: t.profiles?.display_name ?? t.profiles?.username ?? "Fan",
          total: 0,
        };
      }
      gifterMap[key].total += t.receiver_amount ?? 0;
    }

    const topGifters = Object.values(gifterMap)
      .sort((a, b) => b.total - a.total)
      .slice(0, 5);

    const earningsByDay = [];
    for (let i = Math.min(days, 14) - 1; i >= 0; i -= 1) {
      const dayStart = new Date();
      dayStart.setHours(0, 0, 0, 0);
      dayStart.setDate(dayStart.getDate() - i);
      const dayEnd = new Date(dayStart);
      dayEnd.setDate(dayEnd.getDate() + 1);
      const dayTotal =
        (gifts ?? [])
          .filter((g) => {
            const d = new Date(g.created_at);
            return d >= dayStart && d < dayEnd;
          })
          .reduce((s, g) => s + (g.receiver_amount ?? 0), 0) +
        (tips ?? [])
          .filter((t) => {
            const d = new Date(t.created_at);
            return d >= dayStart && d < dayEnd;
          })
          .reduce((s, t) => s + (t.receiver_amount ?? 0), 0);
      earningsByDay.push(dayTotal);
    }
    const maxDay = Math.max(...earningsByDay, 1);

    return {
      giftCoins: profile?.gift_coins ?? 0,
      referralCode: profile?.referral_code ?? null,
      totals: {
        gifts: giftTotal,
        tips: tipTotal,
        subscriptions: subTotal,
        all: giftTotal + tipTotal + subTotal,
      },
      topGifters,
      conversions: (conversions ?? []).map((c) => ({
        amount: c.amount,
        createdAt: c.created_at,
      })),
      linkClicks: linkClicks ?? 0,
      recentTips: (tips ?? []).slice(0, 5).map((t) => ({
        amount: t.amount,
        type: t.tip_type,
        name: t.profiles?.display_name ?? t.profiles?.username ?? "Fan",
        createdAt: t.created_at,
      })),
      chartData: earningsByDay.map((v) => Math.max(8, Math.round((v / maxDay) * 100))),
    };
  },

  async getCreatorMonetizationSettings() {
    const userId = await getUserId();
    const supabase = getSupabase();
    const { data, error } = await supabase
      .from("profiles")
      .select(
        "subscription_price_coins, subscription_description, tip_min_coins, paid_dm_price_coins, referral_code"
      )
      .eq("id", userId)
      .single();
    if (error) throw error;
    return {
      subscriptionPrice: data?.subscription_price_coins ?? null,
      subscriptionDescription: data?.subscription_description ?? "",
      tipMinCoins: data?.tip_min_coins ?? 10,
      paidDmPrice: data?.paid_dm_price_coins ?? null,
      referralCode: data?.referral_code ?? null,
    };
  },

  async updateCreatorMonetization(settings) {
    const supabase = getSupabase();
    const { error } = await supabase.rpc("update_creator_monetization", {
      p_subscription_price: settings.subscriptionPrice ?? null,
      p_subscription_description: settings.subscriptionDescription ?? null,
      p_tip_min: settings.tipMinCoins ?? null,
      p_paid_dm_price: settings.paidDmPrice ?? null,
    });
    if (error) throw error;
    return true;
  },

  async subscribeToCreator(creatorId) {
    const supabase = getSupabase();
    const { data, error } = await supabase.rpc("subscribe_to_creator", { p_creator_id: creatorId });
    if (error) throw error;
    return typeof data === "string" ? JSON.parse(data) : data;
  },

  async sendCreatorTip({ receiverId, amount, message, tipType = "tip" }) {
    const supabase = getSupabase();
    const { data, error } = await supabase.rpc("send_creator_tip", {
      p_receiver_id: receiverId,
      p_amount: amount,
      p_message: message ?? null,
      p_tip_type: tipType,
    });
    if (error) throw error;
    return typeof data === "string" ? JSON.parse(data) : data;
  },

  async promotePost(postId, coins, hours = 24) {
    const supabase = getSupabase();
    const { data, error } = await supabase.rpc("promote_post", {
      p_post_id: postId,
      p_coins: coins,
      p_hours: hours,
    });
    if (error) throw error;
    return typeof data === "string" ? JSON.parse(data) : data;
  },

  async applyReferralCode(code) {
    const supabase = getSupabase();
    const { data, error } = await supabase.rpc("apply_referral_code", { p_code: code });
    if (error) throw error;
    return typeof data === "string" ? JSON.parse(data) : data;
  },

  async recordProfileLinkClick(profileId) {
    const supabase = getSupabase();
    await supabase.rpc("record_profile_link_click", { p_profile_id: profileId }).catch(() => {});
    return true;
  },

  async hasCompletedPurchase() {
    const userId = await getUserId();
    const supabase = getSupabase();
    const { count, error } = await supabase
      .from("transactions")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .eq("status", "success");
    if (error) throw error;
    return (count ?? 0) > 0;
  },

  async confirmAgeGate() {
    const supabase = getSupabase();
    const { data, error } = await supabase.rpc("confirm_age_gate");
    if (error) throw error;
    return data;
  },

  async getAgeConfirmedAt() {
    const userId = await getUserId();
    const supabase = getSupabase();
    const { data, error } = await supabase
      .from("profiles")
      .select("age_confirmed_at")
      .eq("id", userId)
      .single();
    if (error) throw error;
    return data?.age_confirmed_at ?? null;
  },

  async getIsAdmin() {
    const userId = await getUserId();
    const supabase = getSupabase();
    const { data, error } = await supabase
      .from("profiles")
      .select("is_admin")
      .eq("id", userId)
      .single();
    if (error) throw error;
    return Boolean(data?.is_admin);
  },

  async getModerationQueue(status = "pending") {
    const supabase = getSupabase();
    const { data, error } = await supabase
      .from("reports")
      .select("*, reporter:reporter_id (username, display_name)")
      .eq("status", status)
      .order("created_at", { ascending: false })
      .limit(100);
    if (error) throw error;
    return (data ?? []).map((row) => ({
      id: row.id,
      targetType: row.target_type,
      targetId: row.target_id,
      reason: row.reason,
      details: row.details,
      status: row.status,
      createdAt: row.created_at,
      reporterName: row.reporter?.display_name ?? row.reporter?.username ?? "User",
      reporterUsername: row.reporter?.username ?? null,
      resolutionNote: row.resolution_note,
      actionTaken: row.action_taken,
    }));
  },

  async reviewReport(reportId, { status, resolutionNote, actionTaken }) {
    const supabase = getSupabase();
    const { error } = await supabase.rpc("review_report", {
      p_report_id: reportId,
      p_status: status,
      p_resolution_note: resolutionNote ?? null,
      p_action_taken: actionTaken ?? null,
    });
    if (error) throw error;
    return true;
  },

  async getWalletAuditLog(limit = 50) {
    const userId = await getUserId();
    const supabase = getSupabase();
    const { data, error } = await supabase
      .from("wallet_audit_log")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(limit);
    if (error) throw error;
    return (data ?? []).map((row) => ({
      id: row.id,
      action: row.action,
      walletType: row.wallet_type,
      amount: row.amount,
      balanceAfter: row.balance_after,
      referenceType: row.reference_type,
      referenceId: row.reference_id,
      metadata: row.metadata,
      createdAt: row.created_at,
    }));
  },
};

function formatRelative(iso) {
  if (!iso) return "";
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function mapProfileRow(row) {
  return {
    name: row.display_name,
    username: row.username,
    avatar: row.avatar_url,
    cover: row.cover_url ?? "",
    bio: row.bio ?? "",
    phone: row.phone ?? "",
    website: row.website ?? "",
    location: row.location ?? "",
  };
}

function xpForLevel(level) {
  return level * level * 100;
}

function xpProgress(xp, level) {
  const current = (level - 1) ** 2 * 100;
  const next = xpForLevel(level);
  if (next <= current) return 100;
  return Math.min(100, ((xp - current) / (next - current)) * 100);
}

async function syncAchievementBadges(supabase, stats) {
  const toUnlock = [];
  if (stats.uploadCount >= 1) toUnlock.push("1");
  if (stats.views >= 100000) toUnlock.push("2");
  if (stats.commentCount >= 50) toUnlock.push("3");
  if (stats.followers >= 100) toUnlock.push("4");
  if ((stats.giftCount ?? 0) >= 10) toUnlock.push("5");
  if ((stats.giftCount ?? 0) >= 100) toUnlock.push("6");

  for (const badgeId of toUnlock) {
    await supabase.rpc("unlock_badge", { p_badge_id: badgeId });
  }
}
