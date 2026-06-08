import {
  mockAiMessages,
  mockConversations,
  mockCreatorStats,
  mockFeedCommentsByPost,
  mockFeedPosts,
  mockMessagesByChat,
  mockNotifications,
  mockUploads,
} from "@/api/mockData";

import { validateImageFile } from "@/lib/uploadPolicy";
import { calculateGiftSplit } from "@/lib/giftSplit";
import { SIGNUP_BONUS_COINS } from "@/lib/wallet";

const wait = (ms = 150) => new Promise((resolve) => setTimeout(resolve, ms));

let feedPosts = structuredClone(mockFeedPosts);
let conversations = structuredClone(mockConversations);
let messagesByChat = structuredClone(mockMessagesByChat);
let aiMessages = structuredClone(mockAiMessages);
let creatorStats = structuredClone(mockCreatorStats);
let commentsByPost = structuredClone(mockFeedCommentsByPost);
let uploads = structuredClone(mockUploads).map((upload) => ({
  ...upload,
  status: upload.status ?? "draft",
}));
let typingByChat = {};
let hiddenMessageIds = new Set();
let follows = [];
let aiConversationMeta = { title: "UBIRT Assistant" };
let mockProfileExtras = {
  bio: "Digital creator & tech enthusiast. Building the future of content on UBIRT. 🚀",
  phone: "",
  website: "",
  location: "",
  cover: "",
};
let mockPlatformBalance = SIGNUP_BONUS_COINS;
let mockGiftBalance = 0;
let mockReceiverGiftBalances = {};
let notifications = structuredClone(mockNotifications);

const storageKey = "ubirt.mock.state.v1";

function canUseStorage() {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

function hydrateState() {
  if (!canUseStorage()) return;
  const raw = window.localStorage.getItem(storageKey);
  if (!raw) return;
  try {
    const parsed = JSON.parse(raw);
    feedPosts = parsed.feedPosts ?? feedPosts;
    conversations = parsed.conversations ?? conversations;
    messagesByChat = parsed.messagesByChat ?? messagesByChat;
    aiMessages = parsed.aiMessages ?? aiMessages;
    creatorStats = parsed.creatorStats ?? creatorStats;
    commentsByPost = parsed.commentsByPost ?? commentsByPost;
    uploads = parsed.uploads ?? uploads;
    typingByChat = parsed.typingByChat ?? typingByChat;
    hiddenMessageIds = new Set(parsed.hiddenMessageIds ?? []);
    aiConversationMeta = parsed.aiConversationMeta ?? aiConversationMeta;
    follows = parsed.follows ?? follows;
    mockProfileExtras = parsed.mockProfileExtras ?? mockProfileExtras;
    mockPlatformBalance = parsed.mockPlatformBalance ?? parsed.mockWalletBalance ?? mockPlatformBalance;
    mockGiftBalance = parsed.mockGiftBalance ?? mockGiftBalance;
    mockReceiverGiftBalances = parsed.mockReceiverGiftBalances ?? parsed.mockReceiverBalances ?? mockReceiverGiftBalances;
  } catch {
    window.localStorage.removeItem(storageKey);
  }
}

function persistState() {
  if (!canUseStorage()) return;
  window.localStorage.setItem(
    storageKey,
    JSON.stringify({
      feedPosts,
      conversations,
      messagesByChat,
      aiMessages,
      creatorStats,
      commentsByPost,
      uploads,
      typingByChat,
      aiConversationMeta,
      follows,
      mockProfileExtras,
      mockPlatformBalance,
      mockGiftBalance,
      mockReceiverGiftBalances,
      hiddenMessageIds: [...hiddenMessageIds],
    })
  );
}

hydrateState();

export const mockApi = {
  async getFeed(feedType = "foryou") {
    await wait();
    if (feedType === "following") {
       return feedPosts.filter(post => follows.includes(post.author.toLowerCase()));
    }
    return feedPosts;
  },
  async getFeedPost(postId) {
    await wait();
    const post = feedPosts.find((p) => p.id === postId);
    if (!post) throw new Error("Post not found");
    return post;
  },
  async toggleLike(postId) {
    await wait();
    feedPosts = feedPosts.map((post) =>
      post.id === postId ? { ...post, likes: post.likes + 1 } : post
    );
    persistState();
    return feedPosts.find((post) => post.id === postId);
  },
  async toggleBookmark(postId) {
    await wait();
    feedPosts = feedPosts.map((post) =>
      post.id === postId ? { ...post, bookmarked: !post.bookmarked } : post
    );
    persistState();
    return feedPosts.find((post) => post.id === postId);
  },
  async toggleFollow(username) {
    await wait();
    const uname = username.toLowerCase();
    if (follows.includes(uname)) {
       follows = follows.filter(u => u !== uname);
    } else {
       follows.push(uname);
    }
    persistState();
    return follows.includes(uname);
  },
  async isFollowing(username) {
    await wait();
    return follows.includes(username.toLowerCase());
  },
  _mockUsersFromPosts() {
    const seen = new Map();
    for (const post of feedPosts) {
      const username = (post.handle?.replace("@", "") || post.author?.toLowerCase().replace(/\s+/g, "_") || "user").toLowerCase();
      if (!seen.has(username)) {
        seen.set(username, {
          id: `user-${username}`,
          username,
          name: post.author ?? username,
          avatar: null,
        });
      }
    }
    return [...seen.values()];
  },
  async getFollowers(username) {
    await wait();
    const uname = username.toLowerCase();
    return this._mockUsersFromPosts()
      .filter((u) => u.username !== uname)
      .slice(0, 5)
      .map((u) => ({
        ...u,
        isFollowing: follows.includes(u.username),
        isSelf: false,
      }));
  },
  async getFollowing(username) {
    await wait();
    const uname = username.toLowerCase();
    const all = this._mockUsersFromPosts();
    const followingUsers = follows
      .map((followedUsername) => all.find((u) => u.username === followedUsername))
      .filter(Boolean);
    if (followingUsers.length) {
      return followingUsers.map((u) => ({
        ...u,
        isFollowing: follows.includes(u.username),
        isSelf: u.username === uname,
      }));
    }
    return all
      .filter((u) => u.username !== uname)
      .slice(0, 3)
      .map((u) => ({
        ...u,
        isFollowing: follows.includes(u.username),
        isSelf: false,
      }));
  },
  async getPublicProfile(username) {
    await wait();
    const uname = username.toLowerCase();
    const posts = feedPosts.filter(
      (p) =>
        p.username?.toLowerCase() === uname ||
        p.handle === `@${uname}` ||
        p.author?.toLowerCase() === uname
    );
    return {
      id: `user-${uname}`,
      username: uname,
      name: posts[0]?.author ?? username,
      avatar: null,
      bio: mockProfileExtras.bio,
      website: mockProfileExtras.website,
      location: mockProfileExtras.location,
      followers: 12400,
      following: 240,
      totalLikes: posts.reduce((s, p) => s + (p.likes ?? 0), 0),
      isFollowing: follows.includes(uname),
      posts: posts.length ? posts : feedPosts.slice(0, 6),
    };
  },
  async getTransactions() {
    await wait();
    return [
      { id: "tx1", label: "Signup Bonus", coins: SIGNUP_BONUS_COINS, time: "Yesterday", type: "credit" },
      { id: "tx2", label: "Gift to @creator", coins: -50, time: "Today", type: "debit" },
    ];
  },
  async getWalletBalance() {
    await wait(100);
    return {
      platformCoins: mockPlatformBalance,
      giftCoins: mockGiftBalance,
    };
  },

  async convertGiftCoins(amount) {
    await wait(120);
    const parsedAmount = Math.floor(Number(amount) || 0);
    if (parsedAmount <= 0) {
      throw new Error("Enter a valid amount to convert.");
    }
    if (mockGiftBalance < parsedAmount) {
      throw new Error("Insufficient gift coins.");
    }
    mockGiftBalance -= parsedAmount;
    mockPlatformBalance += parsedAmount;
    persistState();
    return {
      success: true,
      amount: parsedAmount,
      platformCoins: mockPlatformBalance,
      giftCoins: mockGiftBalance,
    };
  },
  async getTrendingTags() {
    await wait();
    const counts = {};
    for (const post of feedPosts) {
      for (const tag of post.tags ?? []) {
        counts[tag] = (counts[tag] ?? 0) + 1;
      }
    }
    const sorted = Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6)
      .map(([tag]) => tag);
    return sorted.length ? sorted : ["#Tech", "#Vlog", "#Tutorial", "#Lifestyle", "#Comedy", "#Music"];
  },
  async recordVideoView(postId) {
    await wait(50);
    feedPosts = feedPosts.map((p) =>
      p.id === postId ? { ...p, views: (p.views ?? 0) + 1 } : p
    );
    persistState();
  },
  async getComments(postId) {
    await wait();
    return commentsByPost[postId] ?? [];
  },
  async analyzeCommentToxicity(text) {
    await wait(200);
    const toxicWords = ["hate", "stupid", "idiot", "ugly"];
    return toxicWords.some(word => text.toLowerCase().includes(word));
  },
  async addComment(postId, text) {
    await wait();
    const comment = { id: `c-${Date.now()}`, author: "You", text, isMine: true };
    commentsByPost = {
      ...commentsByPost,
      [postId]: [...(commentsByPost[postId] ?? []), comment],
    };
    feedPosts = feedPosts.map((post) =>
      post.id === postId ? { ...post, comments: (post.comments ?? 0) + 1 } : post
    );
    persistState();
    return comment;
  },
  async deleteComment(postId, commentId) {
    await wait(80);
    const list = commentsByPost[postId] ?? [];
    const next = list.filter((comment) => comment.id !== commentId);
    if (next.length === list.length) return;
    commentsByPost = { ...commentsByPost, [postId]: next };
    feedPosts = feedPosts.map((post) =>
      post.id === postId
        ? { ...post, comments: Math.max(0, (post.comments ?? 0) - 1) }
        : post
    );
    persistState();
  },
  async deletePost(postId) {
    await wait();
    feedPosts = feedPosts.filter(p => p.id !== postId);
    persistState();
    return true;
  },
  async sendGift(postId, amount) {
    await wait();
    const giftAmount = Math.floor(Number(amount) || 0);
    if (giftAmount <= 0) {
      throw new Error("Invalid gift amount.");
    }
    if (mockPlatformBalance < giftAmount) {
      throw new Error("Insufficient platform coins.");
    }

    const post = feedPosts.find((p) => p.id === postId);
    if (!post) {
      throw new Error("Post not found.");
    }

    const { receiverAmount, platformFee } = calculateGiftSplit(giftAmount);
    const receiverKey = post.handle?.replace("@", "") || post.author?.toLowerCase().replace(/\s+/g, "_") || "creator";

    mockPlatformBalance -= giftAmount;
    mockReceiverGiftBalances[receiverKey] = (mockReceiverGiftBalances[receiverKey] ?? 0) + receiverAmount;

    notifications.unshift({
      id: `n-gift-${Date.now()}`,
      type: "gift",
      text: `You received ${receiverAmount} gift coins from a ${giftAmount} coin gift (80%).`,
      time: "now",
      read: false,
    });
    persistState();

    return {
      success: true,
      amount: giftAmount,
      receiverAmount,
      platformFee,
      senderBalance: mockPlatformBalance,
      receiverGiftBalance: mockReceiverGiftBalances[receiverKey],
    };
  },
  async getCreatorAnalytics(days = 28) {
    await wait(500);
    const scale = days / 28;
    return {
      followers: Math.round(12400 * scale),
      views: Math.round(842000 * scale),
      completionRate: 78,
      earnings: 5400,
      chartData: [30, 45, 25, 60, 40, 75, 90].map((v) => Math.round(v * scale)),
      growthPct: 12,
    };
  },
  async search(query) {
    await wait();
    const q = query.trim().toLowerCase();
    if (!q) return { users: [], posts: [], tags: [] };
    const postResults = feedPosts
      .filter((p) => `${p.author} ${p.caption}`.toLowerCase().includes(q))
      .map((p) => ({ ...p, type: "video" }));
    const users = conversations
      .filter((c) => c.name.toLowerCase().includes(q))
      .map((c) => ({
        id: c.id,
        username: c.name.toLowerCase().replace(/\s/g, ""),
        name: c.name,
        avatar: null,
      }));
    return { users, posts: postResults, tags: [`#${q}`] };
  },
  async getSuggestedCreators(limit = 4) {
    await wait();
    return [1, 2, 3, 4].map((i) => ({
      id: `creator-${i}`,
      username: `creator${i}`,
      name: `Creator ${i}`,
      avatar: null,
    }));
  },
  async getConversations(options = {}) {
    await wait();
    const includeArchived = Boolean(options.includeArchived);
    return [...conversations]
      .filter((c) => (includeArchived ? c.archived : !c.archived))
      .sort((a, b) => {
      const aTime = a.sortAt ? new Date(a.sortAt).getTime() : 0;
      const bTime = b.sortAt ? new Date(b.sortAt).getTime() : 0;
      return bTime - aTime;
    });
  },
  async markConversationRead(chatId) {
    await wait(40);
    conversations = conversations.map((c) =>
      c.id === chatId ? { ...c, unread: 0, lastReadAt: new Date().toISOString() } : c
    );
    persistState();
    return true;
  },
  async getConversation(chatId) {
    await wait(80);
    const chat = conversations.find((c) => c.id === chatId);
    if (chat?.type === "group") {
      return {
        id: chatId,
        type: "group",
        name: chat.name ?? "Group",
        avatar: chat.avatar ?? null,
        memberCount: chat.memberCount ?? 1,
        myRole: "owner",
        canManage: true,
        inviteCode: "mockinvite",
        members: [],
        memberReads: [],
        chatTheme: "default",
        isMuted: false,
        showReadReceipts: true,
      };
    }
    return {
      id: chatId,
      type: "direct",
      peerId: chat?.peerId ?? null,
      name: chat?.name ?? "Chat",
      username: chat?.username ?? null,
      avatar: chat?.avatar ?? null,
      lastSeenAt: chat?.lastSeenAt ?? new Date().toISOString(),
      peerLastReadAt: chat?.lastReadAt ?? null,
      peerShowReadReceipts: true,
      chatTheme: "default",
      isMuted: false,
      showReadReceipts: true,
    };
  },
  async updateLastSeen() {
    return true;
  },
  async startConversation(targetUserId) {
    await wait();
    const existing = conversations.find((c) => c.peerId === targetUserId);
    if (existing) return { id: existing.id, name: existing.name };

    const suggested = await this.getSuggestedCreators();
    const user = suggested.find((u) => u.id === targetUserId) ?? {
      id: targetUserId,
      name: "User",
      username: "user",
    };

    const chatId = `c-${Date.now()}`;
    const chat = {
      id: chatId,
      peerId: targetUserId,
      name: user.name,
      lastMessage: "Say hello!",
      updatedAt: "now",
      sortAt: new Date().toISOString(),
      unread: 0,
    };
    conversations = [chat, ...conversations];
    messagesByChat = { ...messagesByChat, [chatId]: [] };
    persistState();
    return { id: chatId, name: chat.name };
  },
  async createGroupConversation(title, memberIds = []) {
    await wait();
    const chatId = `g-${Date.now()}`;
    const inviteCode = `mock${Date.now().toString(36).slice(-8)}`;
    const chat = {
      id: chatId,
      type: "group",
      name: title,
      memberCount: 1 + memberIds.length,
      lastMessage: "Group created",
      updatedAt: "now",
      sortAt: new Date().toISOString(),
      unread: 0,
    };
    conversations = [chat, ...conversations];
    messagesByChat = { ...messagesByChat, [chatId]: [] };
    persistState();
    return {
      id: chatId,
      type: "group",
      name: title,
      avatar: null,
      memberCount: chat.memberCount,
      myRole: "owner",
      canManage: true,
      inviteCode,
      members: [],
    };
  },
  async joinGroupViaInvite(inviteCode) {
    await wait();
    throw new Error("Group invites require Supabase (live mode).");
  },
  async addGroupMembers() {
    await wait();
    return true;
  },
  async updateGroupMemberRole() {
    await wait();
    return true;
  },
  async removeGroupMember() {
    await wait();
    return true;
  },
  async regenerateGroupInvite() {
    await wait();
    return `mock${Date.now().toString(36).slice(-8)}`;
  },
  async getMessages(chatId) {
    await wait();
    return (messagesByChat[chatId] ?? []).filter((message) => !hiddenMessageIds.has(message.id));
  },
  async getChatTyping(chatId) {
    await wait(60);
    return Boolean(typingByChat[chatId]);
  },
  subscribeToMessages(chatId, handlers) {
    return () => {};
  },
  async deleteMessage(messageId, scope = "me") {
    await wait(80);
    if (scope === "me") {
      hiddenMessageIds = new Set([...hiddenMessageIds, messageId]);
      persistState();
      return { scope: "me" };
    }

    for (const chatId of Object.keys(messagesByChat)) {
      const next = (messagesByChat[chatId] ?? []).filter((m) => m.id !== messageId);
      if (next.length !== (messagesByChat[chatId] ?? []).length) {
        messagesByChat = { ...messagesByChat, [chatId]: next };
        hiddenMessageIds.delete(messageId);
        const visible = next.filter((m) => !hiddenMessageIds.has(m.id));
        const last = visible[visible.length - 1];
        conversations = conversations.map((c) =>
          c.id === chatId
            ? {
                ...c,
                lastMessage: last?.text ?? "No messages yet",
                updatedAt: last ? "now" : c.updatedAt,
              }
            : c
        );
        persistState();
        return { scope: "everyone" };
      }
    }
    return { scope: "everyone" };
  },
  subscribeToPresence(chatId, onPresenceChange) {
    return () => {};
  },
  async updateTypingStatus(chatId, isTyping) {
    return true;
  },
  async sendMessage(chatId, text, attachment, options = {}) {
    await wait();
    const isVoice = attachment?.type === "audio";
    const message = {
      id: `m-${Date.now()}`,
      role: "me",
      text: options.sharedPostId ? "Shared a post" : isVoice ? "Voice message" : text,
      status: "sent",
      mediaUrl: isVoice ? URL.createObjectURL(attachment.file) : null,
      mediaType: isVoice ? "audio" : null,
      mediaDuration:
        isVoice && attachment.durationMs > 0
          ? Math.max(1, Math.round(attachment.durationMs / 100) / 10)
          : null,
      replyToId: options.replyToId ?? null,
      replyTo: null,
      sharedPostId: options.sharedPostId ?? null,
      sharedPost: options.sharedPostId ? { id: options.sharedPostId, caption: "Shared post" } : null,
      reactions: [],
      createdAt: new Date().toISOString(),
    };
    messagesByChat = {
      ...messagesByChat,
      [chatId]: [...(messagesByChat[chatId] ?? []), message],
    };
    typingByChat = { ...typingByChat, [chatId]: true };
    const now = new Date().toISOString();
    conversations = conversations.map((c) =>
      c.id === chatId
        ? {
            ...c,
            lastMessage: isVoice ? "Voice message" : text,
            updatedAt: "now",
            sortAt: now,
            unread: 0,
          }
        : c
    );
    persistState();
    window.setTimeout(() => {
      messagesByChat = {
        ...messagesByChat,
        [chatId]: (messagesByChat[chatId] ?? []).map((msg) =>
          msg.id === message.id ? { ...msg, status: "delivered" } : msg
        ),
      };
      persistState();
    }, 900);
    window.setTimeout(() => {
      const reply = {
        id: `r-${Date.now()}`,
        role: "other",
        text: "Nice one. I will review and circle back.",
      };
      messagesByChat = {
        ...messagesByChat,
        [chatId]: [...(messagesByChat[chatId] ?? []), reply],
      };
      typingByChat = { ...typingByChat, [chatId]: false };
      const replyAt = new Date().toISOString();
      conversations = conversations.map((c) =>
        c.id === chatId
          ? { ...c, lastMessage: reply.text, updatedAt: "now", sortAt: replyAt, unread: (c.unread ?? 0) + 1 }
          : c
      );
      persistState();
    }, 1500);
    return message;
  },
  async getAiMessages() {
    await wait();
    return aiMessages;
  },
  async askAi(prompt) {
    await wait(250);
    const userMsg = { id: `u-${Date.now()}`, role: "user", text: prompt };
    const botMsg = {
      id: `a-${Date.now() + 1}`,
      role: "assistant",
      text: `Draft response for: "${prompt}". Next step: refine tone and publish.`,
    };
    aiMessages = [...aiMessages, userMsg, botMsg];
    persistState();
    return { userMsg, botMsg };
  },
  async retryLastAiResponse() {
    await wait(200);
    const lastUser = [...aiMessages].reverse().find((msg) => msg.role === "user");
    if (!lastUser) return null;
    const retryMsg = {
      id: `a-${Date.now()}`,
      role: "assistant",
      text: `Retry response for: "${lastUser.text}". Alternative angle: lead with audience pain point.`,
    };
    aiMessages = [...aiMessages, retryMsg];
    persistState();
    return retryMsg;
  },
  async getAiConversationMeta() {
    await wait();
    return aiConversationMeta;
  },
  async renameAiConversation(title) {
    await wait(100);
    aiConversationMeta = { ...aiConversationMeta, title };
    persistState();
    return aiConversationMeta;
  },
  async deleteAiMessage(messageId) {
    await wait(100);
    aiMessages = aiMessages.filter((message) => message.id !== messageId);
    persistState();
    return true;
  },
  async updateDeviceToken(token, meta = {}) {
    await wait(200);
    console.log("Mock: Device token updated:", token, meta);
    return true;
  },
  async clearAiConversation() {
    await wait(100);
    aiMessages = mockAiMessages;
    persistState();
    return aiMessages;
  },
  async getCreatorStats() {
    const totalLikes = feedPosts.reduce((sum, post) => sum + (post.likes ?? 0), 0);
    return {
      views: 45000,
      followers: 1200,
      following: follows.length,
      totalLikes,
      completionRate: 78,
    };
  },

  async getAchievements() {
    return {
      xp: 2450,
      level: 12,
      xpForNextLevel: 14400,
      xpProgress: 68,
      badges: ["1", "2", "3"],
      quests: [
        { id: "upload", title: "Publish a Post", progress: 1, total: 1, reward: 100, completed: true },
        { id: "comments", title: "Leave 3 Comments", progress: 1, total: 3, reward: 30, completed: false },
        { id: "views", title: "Reach 1,000 Views", progress: 450, total: 1000, reward: 50, completed: false },
      ],
    };
  },
  async saveUpload(payload, file = null) {
    await wait();
    if (file) validateImageFile(file);
    creatorStats = { ...creatorStats, views: creatorStats.views + 140 };
    let mediaUrl = null;
    if (file) {
      mediaUrl = URL.createObjectURL(file);
    }
    const upload = { id: `upload-${Date.now()}`, status: "draft", media_url: mediaUrl, media_type: "image", ...payload };
    uploads = [upload, ...uploads];
    persistState();
    return upload;
  },
  async getUploads() {
    await wait();
    return uploads;
  },
  async updateUpload(uploadId, patch) {
    await wait();
    const existing = uploads.find((upload) => upload.id === uploadId);
    uploads = uploads.map((upload) => (upload.id === uploadId ? { ...upload, ...patch } : upload));
    const updated = uploads.find((upload) => upload.id === uploadId) ?? null;
    if (existing?.media_url && updated?.status === "published") {
      const caption = updated.description || updated.title || "";
      feedPosts = feedPosts.map((post) =>
        post.media_url === existing.media_url ? { ...post, caption } : post
      );
    }
    persistState();
    return updated;
  },
  async deleteUpload(uploadId) {
    await wait();
    const upload = uploads.find((u) => u.id === uploadId);
    if (!upload) throw new Error("Upload not found");
    if (upload.media_url) {
      feedPosts = feedPosts.filter((post) => post.media_url !== upload.media_url);
    }
    uploads = uploads.filter((u) => u.id !== uploadId);
    persistState();
    return true;
  },
  async publishUpload(uploadId) {
    await wait();
    const upload = uploads.find((u) => u.id === uploadId);
    if (!upload) return null;
    
    uploads = uploads.map((u) =>
      u.id === uploadId ? { ...u, status: "published" } : u
    );
    
    const newPost = {
      id: `post-${Date.now()}`,
      author: "You",
      handle: "@you",
      caption: upload.description || upload.title,
      tags: upload.category ? [`#${upload.category}`] : [],
      likes: 0,
      comments: 0,
      bookmarked: false,
      media_url: upload.media_url,
      media_type: upload.media_type,
    };
    feedPosts = [newPost, ...feedPosts];
    
    persistState();
    return { ...upload, status: "published" };
  },
  async getNotifications() {
    await wait();
    return notifications;
  },
  async resolveNotificationLink(item) {
    const { getNotificationPath } = await import("@/lib/notificationLinks");
    return getNotificationPath(item);
  },
  async markNotificationRead(notificationId) {
    await wait();
    notifications = notifications.map((n) =>
      n.id === notificationId ? { ...n, read: true } : n
    );
    persistState();
    return true;
  },
  async markAllNotificationsRead() {
    await wait();
    notifications = notifications.map((n) => ({ ...n, read: true }));
    persistState();
    return true;
  },
  async getOwnProfile() {
    await wait();
    return {
      name: "Alex Demo",
      username: "alexdemo",
      avatar: null,
      cover: mockProfileExtras.cover,
      bio: mockProfileExtras.bio,
      phone: mockProfileExtras.phone,
      website: mockProfileExtras.website,
      location: mockProfileExtras.location,
    };
  },
  async updateProfile({ name, username, bio, phone, website, location, avatarFile, coverFile }) {
    await wait();
    let avatarUrl = undefined;
    let coverUrl = undefined;
    if (avatarFile) {
      avatarUrl = URL.createObjectURL(avatarFile);
    }
    if (coverFile) {
      coverUrl = URL.createObjectURL(coverFile);
    }
    mockProfileExtras = {
      bio: bio ?? mockProfileExtras.bio,
      phone: phone ?? mockProfileExtras.phone,
      website: website ?? mockProfileExtras.website,
      location: location ?? mockProfileExtras.location,
      cover: coverUrl ?? mockProfileExtras.cover,
    };
    persistState();
    return {
      name,
      username,
      avatar: avatarUrl,
      cover: mockProfileExtras.cover,
      bio: mockProfileExtras.bio,
      phone: mockProfileExtras.phone,
      website: mockProfileExtras.website,
      location: mockProfileExtras.location,
    };
  },

  async getBlockedUserIds() {
    await wait();
    return [];
  },

  async blockUser() {
    await wait();
    return true;
  },

  async unblockUser() {
    await wait();
    return true;
  },

  async isUserBlocked() {
    await wait();
    return false;
  },

  async submitReport() {
    await wait();
    return true;
  },

  async getNotificationPreferences() {
    await wait();
    return {
      inApp: true,
      likes: true,
      comments: true,
      messages: true,
      follows: true,
      gifts: true,
    };
  },

  async updateNotificationPreferences(prefs) {
    await wait();
    return prefs;
  },

  async searchMessages(chatId, query) {
    await wait();
    const q = query?.trim()?.toLowerCase();
    if (!q) return [];
    return (messagesByChat[chatId] ?? []).filter((m) => m.text?.toLowerCase().includes(q));
  },

  async toggleMessageReaction(messageId, emoji) {
    await wait();
    for (const chatId of Object.keys(messagesByChat)) {
      const list = messagesByChat[chatId] ?? [];
      const idx = list.findIndex((m) => m.id === messageId);
      if (idx === -1) continue;
      const msg = list[idx];
      const reactions = [...(msg.reactions ?? [])];
      const existing = reactions.find((r) => r.mine);
      if (existing?.emoji === emoji) {
        msg.reactions = reactions.filter((r) => !r.mine);
      } else {
        const filtered = reactions.filter((r) => !r.mine);
        filtered.push({ emoji, count: 1, mine: true, userIds: ["me"] });
        msg.reactions = filtered;
      }
      messagesByChat = { ...messagesByChat, [chatId]: [...list] };
      persistState();
      return { removed: existing?.emoji === emoji, emoji };
    }
    return { removed: false, emoji };
  },

  subscribeToReadReceipts() {
    return () => {};
  },

  subscribeToMessageReactions() {
    return () => {};
  },

  async setConversationMuted(chatId, hours) {
    await wait();
    conversations = conversations.map((c) =>
      c.id === chatId
        ? {
            ...c,
            isMuted: hours > 0,
            mutedUntil: hours > 0 ? new Date(Date.now() + hours * 3600000).toISOString() : null,
          }
        : c
    );
    persistState();
    return { mutedUntil: hours > 0 ? conversations.find((c) => c.id === chatId)?.mutedUntil : null };
  },

  async setConversationArchived(chatId, archived = true) {
    await wait();
    conversations = conversations.map((c) => (c.id === chatId ? { ...c, archived: Boolean(archived) } : c));
    persistState();
    return { archived };
  },

  async updateChatTheme(chatId, theme) {
    await wait();
    return { theme };
  },

  async updateShowReadReceipts(show) {
    await wait();
    return { showReadReceipts: show };
  },

  async getShowReadReceipts() {
    await wait();
    return true;
  },

  async requestWithdrawal({ amount }) {
    await wait();
    return `wd-${amount}-${Date.now()}`;
  },

  async getWithdrawalRequests() {
    await wait();
    return [];
  },

  async updateGroupAvatar() {
    await wait();
    return null;
  },

  async repostPost(postId) {
    await wait();
    const original = feedPosts.find((p) => p.id === postId);
    if (!original) throw new Error("Post not found");
    const repost = {
      ...original,
      id: `repost-${Date.now()}`,
      repostOf: postId,
      originalUsername: original.username,
      caption: original.caption,
    };
    feedPosts = [repost, ...feedPosts];
    persistState();
    return repost;
  },

  async pinPost(postId) {
    await wait();
    return true;
  },

  async unpinPost() {
    await wait();
    return true;
  },

  async getPostIdForUpload() {
    await wait();
    return null;
  },

  async getCreatorEarnings() {
    await wait();
    return {
      giftCoins: 120,
      referralCode: "creator",
      totals: { gifts: 80, tips: 30, subscriptions: 10, all: 120 },
      topGifters: [{ id: "u1", name: "Fan One", total: 50 }],
      conversions: [],
      linkClicks: 12,
      recentTips: [],
      chartData: [20, 40, 30, 60, 45, 80, 55],
    };
  },

  async getCreatorMonetizationSettings() {
    await wait();
    return {
      subscriptionPrice: 200,
      subscriptionDescription: "Exclusive posts and early access",
      tipMinCoins: 10,
      paidDmPrice: 50,
      referralCode: "creator",
    };
  },

  async updateCreatorMonetization() {
    await wait();
    return true;
  },

  async subscribeToCreator() {
    await wait();
    return { success: true, price: 200, expires_at: new Date(Date.now() + 30 * 86400000).toISOString() };
  },

  async sendCreatorTip({ amount }) {
    await wait();
    return { success: true, amount, receiver_amount: Math.floor(amount * 0.8), conversation_id: null };
  },

  async promotePost(_postId, coins) {
    await wait();
    return { success: true, coins_spent: coins };
  },

  async applyReferralCode() {
    await wait();
    return { success: true, bonus_coins: 50 };
  },

  async recordProfileLinkClick() {
    return true;
  },

  async hasCompletedPurchase() {
    await wait();
    return false;
  },

  async getTrendingPosts(limit = 20) {
    await wait();
    return feedPosts.slice(0, limit);
  },

  async getExploreFeed() {
    await wait();
    const tags = await this.getTrendingTags(8);
    return {
      trendingPosts: feedPosts.slice(0, 8),
      trendingTags: tags,
      soundTrends: [],
      locationTags: [],
    };
  },

  async getPostsBySound(soundId) {
    await wait();
    return feedPosts.filter((p) => p.soundId === soundId);
  },

  async getPostsByLocation(locationTag) {
    await wait();
    return feedPosts.filter((p) => p.locationTag === locationTag);
  },

  async votePoll() {
    await wait();
    return { success: true };
  },

  async getProfileQuestions() {
    await wait();
    return [];
  },

  async submitProfileQuestion() {
    await wait();
    return "q-mock";
  },

  async answerProfileQuestion() {
    await wait();
    return true;
  },

  async confirmAgeGate() {
    await wait();
    localStorage.setItem("ubirt.pref.ageConfirmed", "true");
    return new Date().toISOString();
  },

  async getAgeConfirmedAt() {
    await wait();
    return localStorage.getItem("ubirt.pref.ageConfirmed") ? new Date().toISOString() : null;
  },

  async getIsAdmin() {
    await wait();
    return false;
  },

  async getModerationQueue(status = "pending") {
    await wait();
    return [];
  },

  async reviewReport() {
    await wait();
    return true;
  },

  async getWalletAuditLog() {
    await wait();
    return [];
  },
};
