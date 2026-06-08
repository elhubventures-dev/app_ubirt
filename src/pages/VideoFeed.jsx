import { useState, useRef, useEffect, useMemo } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { useFeed, useFeedComments } from "@/hooks/useFeed";
import CommentsSheet from "@/components/feed/CommentsSheet";
import ShareSheet from "@/components/feed/ShareSheet";
import { dataProvider } from "@/api/dataProvider";
import { useAuth } from "@/lib/AuthContext";
import MuxPlayer from "@mux/mux-player-react";
import { useToast } from "@/components/ui/use-toast";
import { PrimaryButton } from "@/components/ui/PrimaryButton";
import { motion, AnimatePresence } from "framer-motion";
import { getPreference } from "@/lib/preferences";
import { isImagePost, stripHashtagsFromCaption } from "@/lib/media";
import NotificationBell from "@/components/layout/NotificationBell";
import { calculateGiftSplit } from "@/lib/giftSplit";
import { saveNavState, loadNavState } from "@/lib/navigationRestore";

function feedStateKey(type) {
  return `feed.${type}`;
}

function VideoPost({ post, isVisible, onLike, onBookmark, setExpandedPostId, isMutating, onAutoScroll, setOptionsPostId, setGiftPostId }) {
  const videoRef = useRef(null);
  const viewedRef = useRef(false);
  const [isPlaying, setIsPlaying] = useState(true);
  const [showPlayOverlay, setShowPlayOverlay] = useState(false);
  const profileSlug = post.username || post.author;
  const avatarSrc = post.avatar || `https://api.dicebear.com/9.x/notionists/svg?seed=${profileSlug}`;
  const captionText = stripHashtagsFromCaption(post.caption);

  useEffect(() => {
    if (isVisible && post.id && !viewedRef.current) {
      viewedRef.current = true;
      dataProvider.recordVideoView(post.id).catch(() => {});
    }
  }, [isVisible, post.id]);

  useEffect(() => {
    if (!videoRef.current) return;
    const autoplayEnabled = getPreference("autoplay", true);
    if (isVisible && autoplayEnabled) {
      videoRef.current.play().catch(() => {});
      setIsPlaying(true);
    } else {
      videoRef.current.pause();
      videoRef.current.currentTime = 0;
      setIsPlaying(false);
    }
  }, [isVisible]);

  // Handle double tap to like & single tap to play/pause
  const [showHeart, setShowHeart] = useState(false);
  const clickTimeout = useRef(null);
  const handleTap = (e) => {
    e.preventDefault();
    if (clickTimeout.current) {
      clearTimeout(clickTimeout.current);
      clickTimeout.current = null;
      // Double tap
      if (!post.liked) {
        onLike(post.id);
      }
      setShowHeart(true);
      setTimeout(() => setShowHeart(false), 800);
    } else {
      // Single tap timeout
      clickTimeout.current = setTimeout(() => {
        clickTimeout.current = null;
        if (videoRef.current) {
          if (isPlaying) {
            videoRef.current.pause();
            setIsPlaying(false);
          } else {
            videoRef.current.play();
            setIsPlaying(true);
          }
          setShowPlayOverlay(true);
          setTimeout(() => setShowPlayOverlay(false), 600);
        }
      }, 250); // wait 250ms for a second tap
    }
  };

  const hasMedia = !!post.media_url;
  const showAsImage = isImagePost(post);
  const mediaFitClass = "max-w-full max-h-full w-auto h-auto object-contain";

  return (
    <div className="relative w-full h-[100dvh] bg-black snap-start flex justify-center items-center overflow-hidden">
      {/* Media — fit uploaded aspect ratio (landscape, portrait, square) without cropping */}
      {hasMedia ? (
        <div className="absolute inset-0 flex items-center justify-center" onClick={handleTap}>
          {showAsImage ? (
            <img src={post.media_url} alt="Post media" className={mediaFitClass} />
          ) : post.mux_playback_id ? (
            <MuxPlayer
              ref={videoRef}
              playbackId={post.mux_playback_id}
              className="w-full h-full max-h-[100dvh]"
              loop={false}
              muted
              autoPlay="muted"
              onEnded={() => onAutoScroll && onAutoScroll()}
              streamType="on-demand"
              style={{ "--controls": "none", "--media-object-fit": "contain" }}
            />
          ) : (
            <video
              ref={videoRef}
              src={post.media_url}
              className={mediaFitClass}
              loop={false}
              muted
              playsInline
              onEnded={() => onAutoScroll && onAutoScroll()}
            />
          )}
        </div>
      ) : (
        <div className="w-full h-full bg-gradient-to-br from-slate-900 to-slate-800 flex items-center justify-center" onClick={handleTap}>
          <p className="text-slate-500 font-medium tracking-widest uppercase">No Media</p>
        </div>
      )}

      {/* Double Tap Heart Animation */}
      <AnimatePresence>
        {showHeart && (
          <motion.div
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1.5, opacity: 1 }}
            exit={{ scale: 2, opacity: 0 }}
            transition={{ duration: 0.4 }}
            className="absolute z-10 pointer-events-none text-red-500 flex items-center justify-center"
          >
            <span className="material-symbols-outlined fill-1" style={{ fontSize: "120px" }}>favorite</span>
          </motion.div>
        )}
        
        {/* Play/Pause Overlay */}
        {showPlayOverlay && (
          <motion.div
            initial={{ scale: 1.5, opacity: 0 }}
            animate={{ scale: 1, opacity: 0.8 }}
            exit={{ scale: 0.5, opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="absolute z-10 pointer-events-none text-white flex items-center justify-center bg-black/30 rounded-full p-4"
          >
            <span className="material-symbols-outlined" style={{ fontSize: "64px" }}>
              {isPlaying ? "play_arrow" : "pause"}
            </span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Overlays */}
      <div className="absolute inset-0 bg-gradient-to-b from-black/30 via-transparent to-black/80 pointer-events-none" />

      {/* Info Area (Bottom Left) */}
      <div className="absolute bottom-24 left-4 right-20 pb-4 pointer-events-auto">
        <Link to={`/user/${profileSlug}`} className="text-white font-bold text-lg drop-shadow-md hover:underline">@{profileSlug}</Link>
        {captionText ? (
          <p className="text-slate-200 text-sm mt-1 drop-shadow-md line-clamp-3">{captionText}</p>
        ) : null}
        {post.tags && post.tags.length > 0 && (
          <div className="flex flex-wrap gap-2 mt-2">
            {post.tags.map((tag, i) => (
              <Link key={i} to={`/tag/${tag.replace('#', '')}`} onClick={(e) => e.stopPropagation()} className="text-xs font-semibold text-[#3b82f6] drop-shadow-md hover:underline">{tag}</Link>
            ))}
          </div>
        )}
      </div>

      {/* Action Bar (Bottom Right) */}
      <div className="absolute bottom-28 right-4 flex flex-col items-center gap-6 pointer-events-auto">
        {/* Avatar */}
        <Link to={`/user/${profileSlug}`} className="w-12 h-12 rounded-full border-2 border-white overflow-hidden bg-slate-800 transition-transform active:scale-90">
          <img src={avatarSrc} alt={post.author || profileSlug} className="w-full h-full object-cover" />
        </Link>

        {/* Like */}
        <button type="button" onClick={() => onLike(post.id)} disabled={isMutating} className="flex flex-col items-center gap-1 group transition-transform active:scale-90">
          <div className="w-10 h-10 rounded-full bg-white/10 backdrop-blur-md flex items-center justify-center text-white group-hover:bg-white/20">
            <span className={`material-symbols-outlined ${post.liked ? 'fill-1 text-red-500' : ''}`}>favorite</span>
          </div>
          <span className="text-white text-xs font-semibold drop-shadow-md">{post.likes}</span>
        </button>

        {/* Comment */}
        <button type="button" onClick={() => setExpandedPostId(post.id)} className="flex flex-col items-center gap-1 group transition-transform active:scale-90">
          <div className="w-10 h-10 rounded-full bg-white/10 backdrop-blur-md flex items-center justify-center text-white group-hover:bg-white/20">
            <span className="material-symbols-outlined fill-1">chat_bubble</span>
          </div>
          <span className="text-white text-xs font-semibold drop-shadow-md">{post.comments}</span>
        </button>

        {/* Bookmark */}
        <button type="button" onClick={() => onBookmark(post.id)} disabled={isMutating} className="flex flex-col items-center gap-1 group transition-transform active:scale-90">
          <div className="w-10 h-10 rounded-full bg-white/10 backdrop-blur-md flex items-center justify-center text-white group-hover:bg-white/20">
            <span className={`material-symbols-outlined ${post.bookmarked ? 'fill-1 text-yellow-400' : ''}`}>bookmark</span>
          </div>
          <span className="text-white text-xs font-semibold drop-shadow-md">{post.bookmarked ? "Saved" : "Save"}</span>
        </button>

        {/* Gift */}
        <button onClick={() => setGiftPostId(post.id)} className="flex flex-col items-center gap-1 group transition-transform active:scale-90">
          <div className="w-10 h-10 rounded-full bg-white/10 backdrop-blur-md flex items-center justify-center text-amber-500 group-hover:bg-white/20">
            <span className="material-symbols-outlined fill-1">featured_seasonal_and_gifts</span>
          </div>
          <span className="text-white text-xs font-semibold drop-shadow-md">Gift</span>
        </button>

        {/* More Options */}
        <button onClick={() => setOptionsPostId(post.id)} className="flex flex-col items-center gap-1 group transition-transform active:scale-90">
          <div className="w-10 h-10 rounded-full bg-white/10 backdrop-blur-md flex items-center justify-center text-white group-hover:bg-white/20">
            <span className="material-symbols-outlined fill-1">more_vert</span>
          </div>
        </button>
      </div>
    </div>
  );
}

export default function VideoFeed() {
  const { user, updateUserSession } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const targetPostId = searchParams.get("post");
  const [expandedPostId, setExpandedPostId] = useState("");
  const [optionsPostId, setOptionsPostId] = useState("");
  const [sharePostId, setSharePostId] = useState("");
  const [giftPostId, setGiftPostId] = useState("");
  const [commentDraft, setCommentDraft] = useState("");
  const [activePostIndex, setActivePostIndex] = useState(0);
  const [feedType, setFeedType] = useState(() => loadNavState("feed.tab")?.feedType ?? "foryou");
  const scrolledToPostRef = useRef(null);
  const postRefs = useRef({});
  const lastFeedRestoreRef = useRef(null);

  const {
    data: posts = [],
    isLoading,
    toggleLike,
    toggleBookmark,
    addComment,
    deleteComment,
    deletePost,
    sendGift,
    isMutating,
    isCommenting,
    isDeletingComment,
    isGifting,
  } = useFeed(feedType);
  const { data: targetPost, isLoading: isLoadingTarget } = useQuery({
    queryKey: ["feed-post", targetPostId],
    queryFn: () => dataProvider.getFeedPost(targetPostId),
    enabled: Boolean(targetPostId),
  });
  const displayPosts = useMemo(() => {
    if (!targetPostId) return posts;
    if (posts.some((p) => p.id === targetPostId)) return posts;
    if (targetPost) return [targetPost, ...posts];
    return posts;
  }, [posts, targetPost, targetPostId]);
  const isFeedReady = !isLoading && (!targetPostId || !isLoadingTarget);

  const { data: comments = [], isLoading: isLoadingComments } = useFeedComments(expandedPostId);
  const { toast } = useToast();
  const containerRef = useRef(null);

  const persistFeedPosition = (index, posts = displayPosts, type = feedType) => {
    const postId = posts[index]?.id;
    if (!postId) return;
    saveNavState("feed.tab", { feedType: type });
    saveNavState(feedStateKey(type), { postId, activePostIndex: index });
  };

  useEffect(() => {
    if (!isFeedReady || !displayPosts.length || targetPostId) return;
    const restoreKey = feedType;
    if (lastFeedRestoreRef.current === restoreKey) return;

    const saved = loadNavState(feedStateKey(feedType));
    lastFeedRestoreRef.current = restoreKey;
    if (!saved) return;

    let index = typeof saved.activePostIndex === "number" ? saved.activePostIndex : 0;
    if (saved.postId) {
      const byId = displayPosts.findIndex((p) => p.id === saved.postId);
      if (byId >= 0) index = byId;
    }
    index = Math.max(0, Math.min(index, displayPosts.length - 1));

    const scrollToIndex = () => {
      const height = window.innerHeight;
      if (containerRef.current) {
        containerRef.current.scrollTop = index * height;
      }
      setActivePostIndex(index);
    };
    requestAnimationFrame(() => requestAnimationFrame(scrollToIndex));
  }, [isFeedReady, displayPosts, feedType, targetPostId]);

  const feedStateRef = useRef({ activePostIndex, displayPosts, feedType });
  feedStateRef.current = { activePostIndex, displayPosts, feedType };

  useEffect(() => {
    return () => {
      const { activePostIndex: index, displayPosts: posts, feedType: type } = feedStateRef.current;
      const postId = posts[index]?.id;
      if (!postId) return;
      saveNavState("feed.tab", { feedType: type });
      saveNavState(feedStateKey(type), { postId, activePostIndex: index });
    };
  }, []);

  useEffect(() => {
    if (!targetPostId || !isFeedReady || !displayPosts.length) return;
    if (scrolledToPostRef.current === `${feedType}:${targetPostId}`) return;

    const index = displayPosts.findIndex((p) => p.id === targetPostId);
    if (index === -1) {
      if (feedType === "following") {
        setFeedType("foryou");
      }
      return;
    }

    const jumpToPost = () => {
      const el = postRefs.current[targetPostId];
      if (el) {
        el.scrollIntoView({ behavior: "auto", block: "start" });
      } else if (containerRef.current) {
        containerRef.current.scrollTo({ top: index * window.innerHeight, behavior: "auto" });
      }
      setActivePostIndex(index);
      scrolledToPostRef.current = `${feedType}:${targetPostId}`;
      setSearchParams({}, { replace: true });
    };

    jumpToPost();
    const frame = requestAnimationFrame(() => {
      requestAnimationFrame(jumpToPost);
    });
    return () => cancelAnimationFrame(frame);
  }, [targetPostId, displayPosts, isFeedReady, feedType, setSearchParams]);

  useEffect(() => {
    if (!targetPostId) {
      scrolledToPostRef.current = null;
    }
  }, [targetPostId]);

  const handleAutoScroll = () => {
    if (!containerRef.current) return;
    const height = window.innerHeight;
    containerRef.current.scrollBy({ top: height, behavior: 'smooth' });
  };


  const handleScroll = () => {
    if (!containerRef.current) return;
    const scrollPos = containerRef.current.scrollTop;
    const windowHeight = window.innerHeight;
    const index = Math.round(scrollPos / windowHeight);
    if (index !== activePostIndex) {
      setActivePostIndex(index);
    }
    persistFeedPosition(index);
  };

  const handleLike = async (postId) => {
    try {
      await toggleLike(postId);
    } catch (error) {
      toast({ title: "Like failed", description: error.message, variant: "destructive" });
    }
  };

  const handleBookmark = async (postId) => {
    const wasSaved = displayPosts.find((p) => p.id === postId)?.bookmarked;
    try {
      await toggleBookmark(postId);
      toast({
        title: wasSaved ? "Removed from saved" : "Saved",
        description: wasSaved ? "Post removed from your saves." : "Post saved to your collection.",
      });
    } catch (error) {
      toast({ title: "Save failed", description: error.message, variant: "destructive" });
    }
  };

  if (!isFeedReady) return (
    <div className="w-full h-[100dvh] flex items-center justify-center bg-black">
      <div className="animate-spin-slow rounded-full h-12 w-12 border-t-2 border-b-2 border-[#0d5bba]"></div>
    </div>
  );

  if (!displayPosts.length) return (
    <div className="w-full h-[100dvh] flex items-center justify-center bg-black">
      <p className="text-slate-300">No posts yet. Create the first upload draft.</p>
    </div>
  );

  return (
    <div className="relative w-full h-[100dvh] bg-black">
      {/* Top Navigation Toggle */}
      <div className="absolute top-0 left-0 right-0 z-50 pt-[calc(env(safe-area-inset-top,0px)+0.75rem)] pb-4 px-4 flex justify-center items-start gap-6 bg-gradient-to-b from-black/60 to-transparent pointer-events-none">
        <div className="absolute top-[calc(env(safe-area-inset-top,0px)+0.75rem)] right-4 pointer-events-auto">
          <NotificationBell variant="overlay" />
        </div>
        <button
          type="button"
          onClick={() => {
            setFeedType("following");
            lastFeedRestoreRef.current = null;
            saveNavState("feed.tab", { feedType: "following" });
          }}
          className={`pointer-events-auto text-lg font-bold transition-colors ${feedType === "following" ? "text-white drop-shadow-md" : "text-white/50"}`}
        >
          Following
          {feedType === "following" && <motion.div layoutId="feedTab" className="h-1 w-6 bg-white mx-auto rounded-full mt-1" />}
        </button>
        <button
          type="button"
          onClick={() => {
            setFeedType("foryou");
            lastFeedRestoreRef.current = null;
            saveNavState("feed.tab", { feedType: "foryou" });
          }}
          className={`pointer-events-auto text-lg font-bold transition-colors ${feedType === "foryou" ? "text-white drop-shadow-md" : "text-white/50"}`}
        >
          For You
          {feedType === "foryou" && <motion.div layoutId="feedTab" className="h-1 w-6 bg-white mx-auto rounded-full mt-1" />}
        </button>
      </div>

      {/* Scrollable Feed Container */}
      <div 
        ref={containerRef}
        onScroll={handleScroll}
        className="w-full h-full overflow-y-scroll snap-y snap-mandatory hide-scrollbar pb-20"
      >
        {displayPosts.map((post, index) => (
          <div
            key={post.id}
            ref={(el) => {
              if (el) postRefs.current[post.id] = el;
              else delete postRefs.current[post.id];
            }}
          >
            <VideoPost
              post={post}
              isVisible={index === activePostIndex}
              onLike={handleLike}
              onBookmark={handleBookmark}
              setExpandedPostId={setExpandedPostId}
              isMutating={isMutating}
              onAutoScroll={handleAutoScroll}
              setOptionsPostId={setOptionsPostId}
              setGiftPostId={setGiftPostId}
            />
          </div>
        ))}
      </div>

      {/* Comments Panel (Slide Up) */}
      <AnimatePresence>
        {expandedPostId && (
          <CommentsSheet
            comments={comments}
            isLoading={isLoadingComments}
            commentDraft={commentDraft}
            onCommentDraftChange={setCommentDraft}
            isSubmitting={isCommenting}
            isDeleting={isDeletingComment}
            onClose={() => setExpandedPostId("")}
            onDeleteComment={async (commentId) => {
              try {
                await deleteComment({ postId: expandedPostId, commentId });
              } catch (error) {
                toast({ title: "Delete failed", description: error.message, variant: "destructive" });
              }
            }}
            onSubmit={async (e) => {
              e.preventDefault();
              const text = commentDraft.trim();
              if (!text) return;
              try {
                await addComment({ postId: expandedPostId, text });
                setCommentDraft("");
              } catch (error) {
                toast({ title: "Comment failed", description: error.message, variant: "destructive" });
              }
            }}
          />
        )}
      </AnimatePresence>

      {/* Options Sheet */}
      <AnimatePresence>
        {optionsPostId && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/60 z-40"
              onClick={() => setOptionsPostId("")}
            />
            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 200 }}
              className="absolute bottom-0 left-0 right-0 h-[40dvh] bg-[#101822] rounded-t-3xl z-50 flex flex-col pointer-events-auto"
            >
              <div className="w-12 h-1.5 bg-white/20 rounded-full mx-auto my-3 shrink-0" />
              <div className="p-6 pt-2 flex flex-col gap-4">
                <h3 className="text-white font-bold text-lg border-b border-white/10 pb-3">Post Options</h3>
                
                {(() => {
                  const targetPost = displayPosts.find((p) => p.id === optionsPostId);
                  const isAuthor =
                    targetPost?.username === user?.username ||
                    targetPost?.userId === user?.id;

                  return (
                    <>
                      <button
                        type="button"
                        onClick={() => {
                          setOptionsPostId("");
                          setSharePostId(optionsPostId);
                        }}
                        className="flex items-center gap-3 text-white hover:bg-white/5 p-4 rounded-2xl transition-colors font-semibold"
                      >
                        <span className="material-symbols-outlined">share</span> Share Post
                      </button>
                      {isAuthor ? (
                        <button
                          type="button"
                          onClick={async () => {
                            try {
                              await deletePost(optionsPostId);
                              toast({ title: "Post Deleted", description: "Your post has been removed." });
                              setOptionsPostId("");
                            } catch (err) {
                              toast({ title: "Delete Failed", description: err.message, variant: "destructive" });
                            }
                          }}
                          className="flex items-center gap-3 text-red-500 hover:bg-white/5 p-4 rounded-2xl transition-colors font-semibold"
                        >
                          <span className="material-symbols-outlined">delete</span> Delete Post
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => {
                            toast({ title: "Post Reported", description: "Thanks for keeping the community safe." });
                            setOptionsPostId("");
                          }}
                          className="flex items-center gap-3 text-red-500 hover:bg-white/5 p-4 rounded-2xl transition-colors font-semibold"
                        >
                          <span className="material-symbols-outlined">flag</span> Report Post
                        </button>
                      )}
                    </>
                  );
                })()}

                  <button onClick={() => setOptionsPostId("")} className="mt-auto bg-white/10 text-white p-4 rounded-2xl font-bold hover:bg-white/20 transition-colors">
                    Cancel
                  </button>
                </div>
              </motion.div>
            </>
          )}
        </AnimatePresence>

      {/* Share Sheet */}
      <AnimatePresence>
        {sharePostId && (
          <ShareSheet
            post={displayPosts.find((p) => p.id === sharePostId)}
            onClose={() => setSharePostId("")}
          />
        )}
      </AnimatePresence>

        {/* Gift Sheet */}
        <AnimatePresence>
          {giftPostId && (
            <>
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="absolute inset-0 bg-black/60 z-40"
                onClick={() => setGiftPostId("")}
              />
              <motion.div
                initial={{ y: "100%" }}
                animate={{ y: 0 }}
                exit={{ y: "100%" }}
                transition={{ type: "spring", damping: 25, stiffness: 200 }}
                className="absolute bottom-0 left-0 right-0 h-[50dvh] bg-[#101822] rounded-t-3xl z-50 flex flex-col pointer-events-auto"
              >
                <div className="w-12 h-1.5 bg-white/20 rounded-full mx-auto my-3 shrink-0" />
                <div className="p-6 pt-2 flex flex-col gap-4 h-full">
                  <div className="flex justify-between items-center border-b border-white/10 pb-3">
                    <div>
                      <h3 className="text-white font-bold text-lg">Send a Gift</h3>
                      <p className="text-[11px] text-slate-400 mt-1">Uses platform coins · Creators receive 80% as gift coins</p>
                    </div>
                    <div className="flex items-center gap-1 text-amber-400 font-bold bg-amber-400/10 px-3 py-1 rounded-full">
                       <span className="material-symbols-outlined text-sm">monetization_on</span>
                       {user?.coins?.toLocaleString() || "0"}
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-3 gap-3 overflow-y-auto">
                    {[
                      { id: "rose", name: "Rose", cost: 10, icon: "🌹" },
                      { id: "star", name: "Star", cost: 20, icon: "⭐" },
                      { id: "coffee", name: "Coffee", cost: 50, icon: "☕" },
                      { id: "heart", name: "Heart", cost: 100, icon: "💖" },
                      { id: "crown", name: "Crown", cost: 500, icon: "👑" },
                      { id: "rocket", name: "Rocket", cost: 1000, icon: "🚀" },
                      { id: "universe", name: "Universe", cost: 5000, icon: "🌌" },
                    ].map(gift => {
                      const { receiverAmount } = calculateGiftSplit(gift.cost);
                      return (
                      <button 
                        key={gift.id}
                        disabled={isGifting}
                        onClick={async () => {
                          try {
                            const result = await sendGift({ postId: giftPostId, amount: gift.cost });
                            if (updateUserSession && result.senderBalance != null) {
                              updateUserSession({ coins: result.senderBalance });
                            } else if (updateUserSession) {
                              updateUserSession({ coins: (user?.coins || 0) - gift.cost });
                            }
                            toast({
                              title: "Gift sent!",
                              description: `${gift.name} sent · Creator receives ${result.receiverAmount ?? receiverAmount} gift coins`,
                            });
                            setGiftPostId("");
                          } catch (err) {
                            toast({ title: "Failed", description: err.message, variant: "destructive" });
                          }
                        }}
                        className="flex flex-col items-center justify-center p-4 bg-white/5 rounded-2xl hover:bg-white/10 border border-transparent hover:border-amber-500/50 transition-all active:scale-95 disabled:opacity-50"
                      >
                         <span className="text-4xl mb-2">{gift.icon}</span>
                         <span className="text-xs font-bold text-white">{gift.name}</span>
                         <div className="flex items-center text-amber-500 text-[10px] font-bold mt-1">
                           <span className="material-symbols-outlined text-[12px] mr-0.5">monetization_on</span>
                           {gift.cost}
                         </div>
                         <p className="text-[9px] text-slate-500 mt-1">+{receiverAmount} to creator</p>
                      </button>
                    );
                    })}
                  </div>
  
                </div>
              </motion.div>
            </>
          )}
        </AnimatePresence>
      </div>
    );
  }
