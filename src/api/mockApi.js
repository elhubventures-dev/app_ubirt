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
let aiConversationMeta = { title: "UBIRT Assistant" };
let follows = ["creator", "tech_guru"]; // mock list of followed usernames

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
    aiConversationMeta = parsed.aiConversationMeta ?? aiConversationMeta;
    follows = parsed.follows ?? follows;
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
  async getComments(postId) {
    await wait();
    return commentsByPost[postId] ?? [];
  },
  async addComment(postId, text) {
    await wait();
    const comment = { id: `c-${Date.now()}`, author: "You", text };
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
  async deletePost(postId) {
    await wait();
    feedPosts = feedPosts.filter(p => p.id !== postId);
    persistState();
    return true;
  },
  async sendGift(postId, amount) {
    await wait();
    // In mock mode, we assume the user has enough coins. We'd usually deduct and record the transaction.
    // Let's just simulate success for now.
    return { success: true, amount };
  },
  async getCreatorAnalytics() {
    await wait(500);
    return {
      followers: 12400,
      views: 842000,
      completionRate: 78,
      earnings: 5400,
      chartData: [30, 45, 25, 60, 40, 75, 90]
    };
  },
  async getConversations() {
    await wait();
    return conversations;
  },
  async getMessages(chatId) {
    await wait();
    return messagesByChat[chatId] ?? [];
  },
  async getChatTyping(chatId) {
    await wait(60);
    return Boolean(typingByChat[chatId]);
  },
  async sendMessage(chatId, text, attachment) {
    await wait();
    let mediaUrl;
    let mediaType;
    if (attachment) {
      mediaUrl = URL.createObjectURL(attachment);
      mediaType = attachment.type.startsWith("video") ? "video" : "image";
    }
    const message = { id: `m-${Date.now()}`, role: "me", text, status: "sent", mediaUrl, mediaType };
    messagesByChat = {
      ...messagesByChat,
      [chatId]: [...(messagesByChat[chatId] ?? []), message],
    };
    typingByChat = { ...typingByChat, [chatId]: true };
    conversations = conversations.map((c) =>
      c.id === chatId ? { ...c, lastMessage: attachment ? "Sent an attachment" : text, updatedAt: "now", unread: 0 } : c
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
      conversations = conversations.map((c) =>
        c.id === chatId ? { ...c, lastMessage: reply.text, updatedAt: "now", unread: c.unread + 1 } : c
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
  async clearAiConversation() {
    await wait(100);
    aiMessages = mockAiMessages;
    persistState();
    return aiMessages;
  },
  async getCreatorStats() {
    await wait();
    return creatorStats;
  },
  async saveUpload(payload, file = null) {
    await wait();
    creatorStats = { ...creatorStats, views: creatorStats.views + 140 };
    let mediaUrl = "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=800&q=80";
    let mediaType = "image";
    if (file) {
      mediaUrl = URL.createObjectURL(file);
      mediaType = file.type.startsWith("video") ? "video" : "image";
    }
    const upload = { id: `upload-${Date.now()}`, status: "draft", media_url: mediaUrl, media_type: mediaType, ...payload };
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
    uploads = uploads.map((upload) => (upload.id === uploadId ? { ...upload, ...patch } : upload));
    persistState();
    return uploads.find((upload) => upload.id === uploadId) ?? null;
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
    return mockNotifications;
  },
  async updateProfile(name, username, avatarFile) {
    await wait();
    let avatarUrl = undefined;
    if (avatarFile) {
       avatarUrl = URL.createObjectURL(avatarFile);
    }
    return { name, username, avatar: avatarUrl };
  },
};
