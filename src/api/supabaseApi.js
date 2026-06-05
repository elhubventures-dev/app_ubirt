import { getSupabase } from "@/lib/supabaseClient";
import { uploadMediaFile } from "@/api/storage";
import { processVideoUpload } from "@/lib/videoPipeline";

async function getUserId() {
  const supabase = getSupabase();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();
  if (error || !user) throw new Error("Not authenticated");
  return user.id;
}

async function notifyUser(recipientId, type, text) {
  if (!recipientId) return;
  const supabase = getSupabase();
  await supabase.rpc("create_notification", {
    p_recipient_id: recipientId,
    p_type: type,
    p_text: text,
  });
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

function inferMediaType(mediaUrl, muxPlaybackId) {
  if (muxPlaybackId) return "video";
  if (!mediaUrl) return "image";
  if (/\.(mp4|webm|ogg|mov|m3u8)(\?|$)/i.test(mediaUrl)) return "video";
  if (/stream\.mux\.com/i.test(mediaUrl)) return "video";
  return "image";
}

function mapPost(row, profile, liked, bookmarked) {
  const hashtags = row.caption?.match(/#[\w]+/g) || [];
  const tags = new Set(hashtags);
  if (row.category) tags.add(`#${row.category.toLowerCase()}`);

  return {
    id: row.id,
    author: profile?.display_name ?? "Creator",
    handle: `@${profile?.username ?? "user"}`,
    caption: row.caption,
    tags: Array.from(tags),
    likes: row.likes_count ?? 0,
    comments: row.comments_count ?? 0,
    views: row.views_count ?? 0,
    bookmarked: Boolean(bookmarked),
    media_url: row.media_url,
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

  async toggleFollow(username) {
    const supabase = getSupabase();
    const { data: targetProfile } = await supabase.from("profiles").select("id").eq("username", username).single();
    if (!targetProfile) return false;
    const { data, error } = await supabase.rpc("toggle_follow", { p_following_id: targetProfile.id });
    if (error) throw error;
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

  async toggleLike(postId) {
    const userId = await getUserId();
    const supabase = getSupabase();
    const { data: existing } = await supabase
      .from("post_likes")
      .select("*")
      .eq("post_id", postId)
      .eq("user_id", userId)
      .maybeSingle();

    if (existing) {
      await supabase.from("post_likes").delete().eq("post_id", postId).eq("user_id", userId);
      await supabase.rpc("decrement_post_likes", { post_id: postId }).catch(() => {});
    } else {
      const { data: post } = await supabase
        .from("posts")
        .select("user_id, likes_count")
        .eq("id", postId)
        .single();
      await supabase.from("post_likes").insert({ post_id: postId, user_id: userId });
      await supabase
        .from("posts")
        .update({ likes_count: (post?.likes_count ?? 0) + 1 })
        .eq("id", postId);
      await supabase.rpc("add_user_xp", { p_user_id: userId, p_amount: 5 });
      const actorName = await getActorDisplayName(userId);
      await notifyUser(post?.user_id, "like", `${actorName} liked your post`);
    }
    const feed = await this.getFeed();
    return feed.find((p) => p.id === postId);
  },

  async toggleBookmark(postId) {
    const userId = await getUserId();
    const supabase = getSupabase();
    const { data: existing } = await supabase
      .from("post_bookmarks")
      .select("*")
      .eq("post_id", postId)
      .eq("user_id", userId)
      .maybeSingle();

    if (existing) {
      await supabase.from("post_bookmarks").delete().eq("post_id", postId).eq("user_id", userId);
    } else {
      await supabase.from("post_bookmarks").insert({ post_id: postId, user_id: userId });
    }
    const feed = await this.getFeed();
    return feed.find((p) => p.id === postId);
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
    const userId = await getUserId();
    const supabase = getSupabase();
    // In a real app we'd use an RPC to safely deduct and transfer coins.
    // Here we'll just simulate success or throw if the user has insufficient coins.
    const { data: profile } = await supabase.from("profiles").select("coins").eq("id", userId).single();
    if ((profile?.coins ?? 1000) < amount) {
      throw new Error("Insufficient coins.");
    }
    // Update local user's coin balance by deducting
    const { error } = await supabase.from("profiles").update({ coins: (profile?.coins ?? 1000) - amount }).eq("id", userId);
    if (error) throw error;
    return { success: true, amount };
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
    const { data: post } = await supabase
      .from("posts")
      .select("user_id, comments_count")
      .eq("id", postId)
      .single();
    await supabase
      .from("posts")
      .update({ comments_count: (post?.comments_count ?? 0) + 1 })
      .eq("id", postId);
    await supabase.rpc("add_user_xp", { p_user_id: userId, p_amount: 10 });
    const actorName = await getActorDisplayName(userId);
    await notifyUser(post?.user_id, "comment", `${actorName} commented on your post`);
    return { id: data.id, author: "You", text: data.text };
  },

  async getConversations() {
    const userId = await getUserId();
    const supabase = getSupabase();
    const { data: memberships, error } = await supabase
      .from("conversation_members")
      .select("conversation_id, conversations(*)")
      .eq("user_id", userId);
    if (error) throw error;

    let rows = memberships ?? [];
    if (rows.length === 0) {
      const { data: conv, error: convErr } = await supabase
        .from("conversations")
        .insert({ title: "Welcome" })
        .select()
        .single();
      if (!convErr && conv) {
        await supabase.from("conversation_members").insert({
          conversation_id: conv.id,
          user_id: userId,
        });
        await supabase.from("messages").insert({
          conversation_id: conv.id,
          sender_id: userId,
          content: "Welcome to UBIRT messaging.",
          status: "delivered",
        });
        const { data: refreshed } = await supabase
          .from("conversation_members")
          .select("conversation_id, conversations(*)")
          .eq("user_id", userId);
        rows = refreshed ?? [];
      }
    }

    const results = [];
    for (const row of rows) {
      const conv = row.conversations;
      if (!conv) continue;
      const { data: lastMsg } = await supabase
        .from("messages")
        .select("content, created_at, sender_id")
        .eq("conversation_id", conv.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      const { count } = await supabase
        .from("messages")
        .select("*", { count: "exact", head: true })
        .eq("conversation_id", conv.id)
        .neq("sender_id", userId);
      results.push({
        id: conv.id,
        name: conv.title ?? "Conversation",
        lastMessage: lastMsg?.content ?? "No messages yet",
        updatedAt: formatRelative(conv.updated_at),
        unread: 0,
      });
    }
    return results;
  },

  async getMessages(chatId) {
    const userId = await getUserId();
    const supabase = getSupabase();
    const { data, error } = await supabase
      .from("messages")
      .select("*")
      .eq("conversation_id", chatId)
      .order("created_at", { ascending: true });
    if (error) throw error;
    return (data ?? []).map((m) => ({
      id: m.id,
      role: m.sender_id === userId ? "me" : "other",
      text: m.content,
      status: m.status,
      mediaUrl: m.media_url,
      mediaType: m.media_type,
    }));
  },

  async getChatTyping(chatId) {
    return false;
  },

  subscribeToMessages(chatId, onMessage) {
    const supabase = getSupabase();
    const channel = supabase
      .channel(`messages:${chatId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
          filter: `conversation_id=eq.${chatId}`,
        },
        async (payload) => {
          const userId = await getUserId();
          const m = payload.new;
          onMessage({
            id: m.id,
            role: m.sender_id === userId ? "me" : "other",
            text: m.content,
            status: m.status,
            mediaUrl: m.media_url,
            mediaType: m.media_type,
          });
        }
      )
      .subscribe();
    return () => supabase.removeChannel(channel);
  },

  subscribeToPresence(chatId, onPresenceChange) {
    const supabase = getSupabase();
    const channel = supabase.channel(`presence:${chatId}`, {
      config: { presence: { key: 'user' } },
    });
    
    channel
      .on('presence', { event: 'sync' }, () => {
        const state = channel.presenceState();
        onPresenceChange(state);
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          const userId = await getUserId();
          const { data: profile } = await supabase.from('profiles').select('username, display_name').eq('id', userId).single();
          await channel.track({ online_at: new Date().toISOString(), user_id: userId, profile });
        }
      });
    return () => supabase.removeChannel(channel);
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
    
    let mediaUrl;
    let mediaType;
    if (attachment) {
      const res = await uploadMediaFile(attachment, "chat_media");
      mediaUrl = res.url;
      mediaType = attachment.type.startsWith("video") ? "video" : "image";
    }

    const { data, error } = await supabase
      .from("messages")
      .insert({
        conversation_id: chatId,
        sender_id: userId,
        content: text,
        status: "sent",
        media_url: mediaUrl,
        media_type: mediaType,
      })
      .select()
      .single();
    if (error) throw error;
    await supabase.from("conversations").update({ updated_at: new Date().toISOString() }).eq("id", chatId);
    return {
      id: data.id,
      role: "me",
      text: data.content,
      status: data.status,
      mediaUrl: data.media_url,
      mediaType: data.media_type,
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

  async updateDeviceToken(token) {
    const userId = await getUserId();
    const supabase = getSupabase();
    // In a real app, you might have a push_tokens table or an array on the profile.
    // Assuming there's a device_token string or string array on profiles.
    const { error } = await supabase
      .from("profiles")
      .update({ device_token: token })
      .eq("id", userId);
    if (error) throw error;
    console.log("Device token updated in Supabase:", token);
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
    const { count: followers } = await supabase.from("follows").select("*", { count: "exact", head: true }).eq("following_id", userId);
    const { data: posts } = await supabase.from("posts").select("views_count").eq("user_id", userId);
    const views = (posts ?? []).reduce((sum, p) => sum + (p.views_count ?? 0), 0);
    const { data: uploads } = await supabase.from("uploads").select("id").eq("user_id", userId);
    return {
      views,
      followers: followers ?? 0,
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
      const processed = await processVideoUpload(file, userId);
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
    const supabase = getSupabase();
    const { data, error } = await supabase
      .from("uploads")
      .update(patch)
      .eq("id", uploadId)
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async publishUpload(uploadId) {
    return this.updateUpload(uploadId, { status: "published" });
  },

  async getNotifications() {
    const userId = await getUserId();
    const supabase = getSupabase();
    const { data, error } = await supabase
      .from("notifications")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });
    if (error) throw error;
    return (data ?? []).map((n) => ({
      id: n.id,
      type: n.type,
      text: n.text,
      time: formatRelative(n.created_at),
      read: n.read ?? false,
    }));
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

  async updateProfile(name, username, avatarFile) {
    const userId = await getUserId();
    const supabase = getSupabase();
    
    let avatarUrl = undefined;
    if (avatarFile) {
       // upload the file
       const res = await uploadMediaFile(avatarFile, "avatars");
       avatarUrl = res.url;
    }
    
    const updates = { display_name: name, username: username };
    if (avatarUrl) updates.avatar_url = avatarUrl;
    
    const { data, error } = await supabase
      .from("profiles")
      .update(updates)
      .eq("id", userId)
      .select()
      .single();
    if (error) throw error;
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
    await supabase.rpc("unlock_badge", { p_badge_id: badgeId }).catch(() => {});
  }
}
