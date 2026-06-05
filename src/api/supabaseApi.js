import { getSupabase } from "@/lib/supabaseClient";
import { uploadAvatar, uploadCover, uploadVoiceFile } from "@/api/storage";
import { processImageUpload } from "@/lib/videoPipeline";
import { inferMediaType } from "@/lib/media";
import { getNotificationPath } from "@/lib/notificationLinks";

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

  // Best-effort push fanout after in-app notification is created.
  try {
    await fetch("/api/push/send", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        userId: recipientId,
        notificationId,
        type,
        title: options.title || (type === "message" ? "New message" : "UBIRT"),
        body: text,
        data: Object.keys(pushData).length ? pushData : undefined,
      }),
    });
  } catch (pushError) {
    console.warn("Push send failed:", pushError);
  }
}

async function getActorDisplayName(userId) {
  const supabase = getSupabase();
  const { data } = await supabase
    .from("profiles")
    .select("display_name")
    .eq("id", userId)
    .maybeSingle();
  return data?.display_name ?? "Someone";
}

function mapPost(row, profile, liked, bookmarked) {
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
  };
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
    
    let filteredPosts = posts;
    if (feedType === "following") {
      const { data: follows } = await supabase.from("follows").select("following_id").eq("follower_id", userId);
      const followingIds = new Set((follows || []).map(f => f.following_id));
      filteredPosts = posts.filter(p => p.profiles && followingIds.has(p.profiles.id));
    }

    const { data: likes } = await supabase.from("post_likes").select("post_id").eq("user_id", userId);
    const { data: bookmarks } = await supabase.from("post_bookmarks").select("post_id").eq("user_id", userId);
    const likedSet = new Set((likes || []).map((l) => l.post_id));
    const bookmarkedSet = new Set((bookmarks || []).map((b) => b.post_id));

    return filteredPosts.map((p) => mapPost(p, p.profiles, likedSet.has(p.id), bookmarkedSet.has(p.id)));
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
      try {
        const actorId = await getUserId();
        const actorName = await getActorDisplayName(actorId);
        await fetch("/api/push/send", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            userId: targetProfile.id,
            type: "follow",
            title: "New follower",
            body: `${actorName} started following you`,
          }),
        });
      } catch (pushError) {
        console.warn("Follow push failed:", pushError);
      }
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
      .select("id, username, display_name, avatar_url, cover_url, bio, website, location")
      .eq("username", username)
      .maybeSingle();
    if (error) throw error;
    if (!profile) return null;

    const [
      { count: followersCount },
      { count: followingCount },
      { data: posts },
      followRow,
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
    ]);

    const totalLikes = (posts ?? []).reduce((sum, p) => sum + (p.likes_count ?? 0), 0);

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
      isFollowing: !!followRow?.data,
      posts: (posts ?? []).map((p) => mapPost(p, profile, false, false)),
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
    const { data, error } = await supabase.from("profiles").select("coins").eq("id", userId).single();
    if (error) throw error;
    return data?.coins ?? 0;
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
      try {
        await fetch("/api/push/send", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            userId: result.receiver_id,
            type: "gift",
            title: "Gift received!",
            body: `You received ${result.receiver_amount} coins from a gift.`,
          }),
        });
      } catch (pushError) {
        console.warn("Gift push failed:", pushError);
      }
    }

    return {
      success: true,
      amount: result.amount ?? giftAmount,
      receiverAmount: result.receiver_amount,
      platformFee: result.platform_fee,
      senderBalance: result.sender_balance,
      receiverBalance: result.receiver_balance,
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
    const { data: profile } = await supabase.from("profiles").select("coins").eq("id", userId).single();

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
      earnings: profile?.coins ?? 0,
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

  async getSuggestedCreators() {
    const userId = await getUserId();
    const supabase = getSupabase();
    const { data: following } = await supabase
      .from("follows")
      .select("following_id")
      .eq("follower_id", userId);
    const exclude = new Set([userId, ...(following ?? []).map((f) => f.following_id)]);
    const { data } = await supabase
      .from("profiles")
      .select("id, username, display_name, avatar_url")
      .limit(12);

    return (data ?? [])
      .filter((p) => !exclude.has(p.id))
      .slice(0, 4)
      .map((u) => ({
        id: u.id,
        username: u.username,
        name: u.display_name ?? u.username,
        avatar: u.avatar_url,
      }));
  },

  async getComments(postId) {
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
      text: c.text,
    }));
  },

  async addComment(postId, text) {
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
    return { id: data.id, author: actorName, text: data.text };
  },

  async getConversation(chatId) {
    const userId = await getUserId();
    const supabase = getSupabase();
    const { data: members, error } = await supabase
      .from("conversation_members")
      .select("user_id, profiles:user_id (display_name, username, avatar_url, last_seen_at)")
      .eq("conversation_id", chatId);
    if (error) throw error;

    const otherMember = (members ?? []).find((m) => m.user_id !== userId);
    const otherProfile = otherMember?.profiles;

    return {
      id: chatId,
      peerId: otherMember?.user_id ?? null,
      name: otherProfile?.display_name ?? otherProfile?.username ?? "Chat",
      username: otherProfile?.username ?? null,
      avatar: otherProfile?.avatar_url ?? null,
      lastSeenAt: otherProfile?.last_seen_at ?? null,
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

  async getConversations() {
    const userId = await getUserId();
    const supabase = getSupabase();
    const { data: memberships, error } = await supabase
      .from("conversation_members")
      .select("conversation_id, last_read_at, conversations(*)")
      .eq("user_id", userId);
    if (error) throw error;

    const rows = memberships ?? [];
    const hiddenIds = await getHiddenMessageIds(userId);
    const results = [];
    for (const row of rows) {
      const conv = row.conversations;
      if (!conv) continue;

      const { data: members } = await supabase
        .from("conversation_members")
        .select("user_id, profiles:user_id (display_name, username, avatar_url, last_seen_at)")
        .eq("conversation_id", conv.id);

      const otherMember = (members ?? []).find((m) => m.user_id !== userId);
      const otherProfile = otherMember?.profiles;

      let lastMsgQuery = supabase
        .from("messages")
        .select("content, created_at, sender_id, media_type")
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

      results.push({
        id: conv.id,
        name: otherProfile?.display_name ?? otherProfile?.username ?? conv.title ?? "Conversation",
        avatar: otherProfile?.avatar_url ?? null,
        lastMessage:
          lastMsg?.media_type === "audio"
            ? "Voice message"
            : lastMsg?.content ?? "No messages yet",
        updatedAt: formatRelative(sortAt),
        sortAt,
        unread: unreadCount ?? 0,
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

    const res = await fetch("/api/conversations/start", {
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
    return (data ?? []).map((m) => ({
      id: m.id,
      role: m.sender_id === userId ? "me" : "other",
      text: m.content,
      status: m.status,
      mediaUrl: m.media_url,
      mediaType: m.media_type,
      mediaDuration: m.media_duration ?? null,
    }));
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
          onInsert({
            id: m.id,
            role: m.sender_id === userId ? "me" : "other",
            text: m.content,
            status: m.status,
            mediaUrl: m.media_url,
            mediaType: m.media_type,
            mediaDuration: m.media_duration ?? null,
          });
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

  async sendMessage(chatId, text, attachment) {
    const userId = await getUserId();
    const supabase = getSupabase();
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

    if (!content && !mediaUrl) {
      throw new Error("Message cannot be empty.");
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
      })
      .select()
      .single();
    if (error) throw error;
    await supabase.from("conversations").update({ updated_at: new Date().toISOString() }).eq("id", chatId);

    const actorName = await getActorDisplayName(userId);
    const preview =
      mediaType === "audio"
        ? "Voice message"
        : content.length > 80
          ? `${content.slice(0, 77)}...`
          : content;
    const { data: members } = await supabase
      .from("conversation_members")
      .select("user_id")
      .eq("conversation_id", chatId)
      .neq("user_id", userId);

    for (const member of members ?? []) {
      try {
        await notifyUser(member.user_id, "message", `${actorName}: ${preview}`, {
          chatId,
          conversationId: chatId,
          url: `/chat/${chatId}`,
        });
      } catch (notifyError) {
        console.warn("Failed to notify message recipient:", notifyError);
      }
    }

    return {
      id: data.id,
      role: "me",
      text: data.content,
      status: data.status,
      mediaUrl: data.media_url,
      mediaType: data.media_type,
      mediaDuration: data.media_duration ?? null,
    };
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
    const supabase = getSupabase();
    const { error } = await supabase.from("comments").delete().eq("id", commentId);
    if (error) throw error;
  },

  async analyzeCommentToxicity(text) {
    try {
      const res = await fetch("/api/ai/moderate", {
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
      const res = await fetch("/api/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
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
    const { data: posts } = await supabase.from("posts").select("views_count").eq("user_id", userId);
    const views = (posts ?? []).reduce((sum, p) => sum + (p.views_count ?? 0), 0);
    const { data: uploads } = await supabase.from("uploads").select("id").eq("user_id", userId);
    return {
      views,
      followers: followers ?? 0,
      following: following ?? 0,
      completionRate: Math.min(100, 40 + (uploads?.length ?? 0) * 5),
    };
  },

  async saveUpload(payload, file = null) {
    const userId = await getUserId();
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
    const directPath = getNotificationPath(item);
    if (directPath) return directPath;

    const type = String(item?.type || "").toLowerCase();
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
      })
      .select()
      .single();
    if (error) throw error;
    await supabase.rpc("add_user_xp", { p_user_id: userId, p_amount: 50 });
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
      { data: posts },
    ] = await Promise.all([
      supabase.from("comments").select("*", { count: "exact", head: true }).eq("user_id", userId),
      supabase.from("uploads").select("*", { count: "exact", head: true }).eq("user_id", userId).eq("status", "published"),
      supabase.from("follows").select("*", { count: "exact", head: true }).eq("following_id", userId),
      supabase.from("posts").select("views_count").eq("user_id", userId),
    ]);

    const views = (posts ?? []).reduce((sum, p) => sum + (p.views_count ?? 0), 0);
    await syncAchievementBadges(supabase, {
      uploadCount: uploadCount ?? 0,
      commentCount: commentCount ?? 0,
      followers: followers ?? 0,
      views,
    });

    const { data: unlocked } = await supabase.from("user_achievements").select("badge_id").eq("user_id", userId);
    const quests = [
      {
        id: "upload",
        title: "Upload a Video",
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

  for (const badgeId of toUnlock) {
    await supabase.rpc("unlock_badge", { p_badge_id: badgeId });
  }
}
