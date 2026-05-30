export const mockFeedPosts = [
  {
    id: "post-1",
    author: "Maya Chen",
    handle: "@maya.builds",
    caption: "Prototype day: AI clip tagging is finally fast.",
    tags: ["#ai", "#creator", "#ubirt"],
    likes: 124,
    comments: 18,
    bookmarked: false,
  },
  {
    id: "post-2",
    author: "Noah Reed",
    handle: "@noah.reels",
    caption: "New camera motion recipe for smoother transitions.",
    tags: ["#video", "#editing"],
    likes: 89,
    comments: 9,
    bookmarked: true,
  },
  {
    id: "post-3",
    author: "Sara Kim",
    handle: "@sara.codes",
    caption: "Built an auto-caption pipeline in under an hour.",
    tags: ["#dev", "#automation"],
    likes: 210,
    comments: 34,
    bookmarked: false,
  },
];

export const mockFeedCommentsByPost = {
  "post-1": [
    { id: "c-1", author: "Noah", text: "This is clean. Ship it." },
    { id: "c-2", author: "Sara", text: "Can you share the prompt recipe?" },
  ],
  "post-2": [{ id: "c-3", author: "Maya", text: "Love this transition style." }],
  "post-3": [],
};

export const mockConversations = [
  {
    id: "chat-1",
    name: "Maya Chen",
    lastMessage: "Can you review the upload flow?",
    updatedAt: "2m ago",
    unread: 2,
  },
  {
    id: "chat-2",
    name: "Creators Guild",
    lastMessage: "Drop your latest experiments here.",
    updatedAt: "25m ago",
    unread: 0,
  },
];

export const mockMessagesByChat = {
  "chat-1": [
    { id: "m1", role: "other", text: "Can you review the upload flow?" },
    { id: "m2", role: "me", text: "Yes, sending notes in 10 minutes." },
  ],
  "chat-2": [{ id: "m3", role: "other", text: "Drop your latest experiments here." }],
};

export const mockAiMessages = [
  { id: "a1", role: "assistant", text: "Hi. I can help with scripts, hooks, and UX copy." },
];

export const mockNotifications = [
  { id: "n1", type: "comment", text: "Maya commented on your clip draft.", time: "8m ago" },
  { id: "n2", type: "mention", text: "Noah mentioned you in #creator-lab.", time: "30m ago" },
];

export const mockCreatorStats = {
  views: 18420,
  followers: 912,
  completionRate: 67,
};

export const mockUploads = [
  {
    id: "upload-seed-1",
    title: "Launch teaser",
    description: "First launch teaser draft.",
    category: "Product",
    visibility: "team",
  },
];
