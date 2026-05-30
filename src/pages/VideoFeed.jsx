import { useState, useRef, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useFeed, useFeedComments } from "@/hooks/useFeed";
import { useAuth } from "@/lib/AuthContext";
import MuxPlayer from "@mux/mux-player-react";
import { useToast } from "@/components/ui/use-toast";
import { PrimaryButton } from "@/components/ui/PrimaryButton";
import { InputField } from "@/components/ui/InputField";
import { motion, AnimatePresence } from "framer-motion";

function VideoPost({ post, isVisible, toggleLike, toggleBookmark, setExpandedPostId, isMutating, onAutoScroll, setOptionsPostId }) {
  const videoRef = useRef(null);
  const [isPlaying, setIsPlaying] = useState(true);
  const [showPlayOverlay, setShowPlayOverlay] = useState(false);

  useEffect(() => {
    if (!videoRef.current) return;
    if (isVisible) {
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
        toggleLike(post.id);
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

  return (
    <div className="relative w-full h-[100dvh] bg-black snap-start flex justify-center items-center overflow-hidden">
      {/* Media Background */}
      {hasMedia ? (
        post.media_type === "image" ? (
          <img src={post.media_url} alt="Post media" className="w-full h-full object-cover" onClick={handleTap} />
        ) : post.mux_playback_id ? (
          <div onClick={handleTap} className="w-full h-full overflow-hidden relative">
            <MuxPlayer
              ref={videoRef}
              playbackId={post.mux_playback_id}
              className="w-full h-full object-cover absolute inset-0 scale-[1.01]"
              loop={false}
              muted
              autoPlay="muted"
              onEnded={() => onAutoScroll && onAutoScroll()}
              streamType="on-demand"
              style={{ "--controls": "none", "--media-object-fit": "cover" }}
            />
          </div>
        ) : (
          <video
            ref={videoRef}
            src={post.media_url}
            className="w-full h-full object-cover"
            loop={false}
            muted
            playsInline
            onClick={handleTap}
            onEnded={() => onAutoScroll && onAutoScroll()}
          />
        )
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
        <Link to={`/user/${post.author}`} className="text-white font-bold text-lg drop-shadow-md hover:underline">@{post.author}</Link>
        <p className="text-slate-200 text-sm mt-1 drop-shadow-md line-clamp-3">{post.caption}</p>
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
        <Link to={`/user/${post.author}`} className="w-12 h-12 rounded-full border-2 border-white overflow-hidden bg-slate-800 transition-transform active:scale-90">
          <img src={`https://api.dicebear.com/9.x/notionists/svg?seed=${post.author}`} alt="Avatar" className="w-full h-full object-cover" />
        </Link>

        {/* Like */}
        <button onClick={() => toggleLike(post.id)} disabled={isMutating} className="flex flex-col items-center gap-1 group transition-transform active:scale-90">
          <div className="w-10 h-10 rounded-full bg-white/10 backdrop-blur-md flex items-center justify-center text-white group-hover:bg-white/20">
            <span className={`material-symbols-outlined ${post.liked ? 'fill-1 text-red-500' : ''}`}>favorite</span>
          </div>
          <span className="text-white text-xs font-semibold drop-shadow-md">{post.likes}</span>
        </button>

        {/* Comment */}
        <button onClick={() => setExpandedPostId(post.id)} className="flex flex-col items-center gap-1 group transition-transform active:scale-90">
          <div className="w-10 h-10 rounded-full bg-white/10 backdrop-blur-md flex items-center justify-center text-white group-hover:bg-white/20">
            <span className="material-symbols-outlined fill-1">chat_bubble</span>
          </div>
          <span className="text-white text-xs font-semibold drop-shadow-md">{post.comments}</span>
        </button>

        {/* Bookmark */}
        <button onClick={() => toggleBookmark(post.id)} disabled={isMutating} className="flex flex-col items-center gap-1 group transition-transform active:scale-90">
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
  const [expandedPostId, setExpandedPostId] = useState("");
  const [optionsPostId, setOptionsPostId] = useState("");
  const [giftPostId, setGiftPostId] = useState("");
  const [commentDraft, setCommentDraft] = useState("");
  const [activePostIndex, setActivePostIndex] = useState(0);
  const [feedType, setFeedType] = useState("foryou"); // "foryou" | "following"
  
  const { data: posts = [], isLoading, toggleLike, toggleBookmark, addComment, deletePost, sendGift, isMutating, isCommenting, isGifting } = useFeed(feedType);
  const { data: comments = [] } = useFeedComments(expandedPostId);
  const { toast } = useToast();
  const containerRef = useRef(null);

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
  };

  if (isLoading) return (
    <div className="w-full h-[100dvh] flex items-center justify-center bg-black">
      <div className="animate-spin-slow rounded-full h-12 w-12 border-t-2 border-b-2 border-[#0d5bba]"></div>
    </div>
  );

  if (!posts.length) return (
    <div className="w-full h-[100dvh] flex items-center justify-center bg-black">
      <p className="text-slate-300">No posts yet. Create the first upload draft.</p>
    </div>
  );

  return (
    <div className="relative w-full h-[100dvh] bg-black">
      {/* Top Navigation Toggle */}
      <div className="absolute top-0 left-0 right-0 z-10 pt-12 pb-4 flex justify-center gap-6 pointer-events-auto bg-gradient-to-b from-black/60 to-transparent">
        <button 
          onClick={() => setFeedType("following")}
          className={`text-lg font-bold transition-colors ${feedType === "following" ? "text-white drop-shadow-md" : "text-white/50"}`}
        >
          Following
          {feedType === "following" && <motion.div layoutId="feedTab" className="h-1 w-6 bg-white mx-auto rounded-full mt-1" />}
        </button>
        <button 
          onClick={() => setFeedType("foryou")}
          className={`text-lg font-bold transition-colors ${feedType === "foryou" ? "text-white drop-shadow-md" : "text-white/50"}`}
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
        {posts.map((post, index) => (
          <VideoPost
            key={post.id}
            post={post}
            isVisible={index === activePostIndex}
            toggleLike={toggleLike}
            toggleBookmark={toggleBookmark}
            setExpandedPostId={setExpandedPostId}
            isMutating={isMutating}
            onAutoScroll={handleAutoScroll}
            setOptionsPostId={setOptionsPostId}
          />
        ))}
      </div>

      {/* Comments Panel (Slide Up) */}
      <AnimatePresence>
        {expandedPostId && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setExpandedPostId("")}
              className="absolute inset-0 bg-black/60 z-40 backdrop-blur-sm"
            />
            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 200 }}
              className="absolute bottom-0 left-0 right-0 h-[60dvh] bg-[#101822] rounded-t-3xl z-50 flex flex-col shadow-2xl border-t border-white/10"
            >
              <div className="flex justify-center p-3">
                <div className="w-12 h-1.5 bg-white/20 rounded-full" />
              </div>
              <div className="px-4 pb-3 flex justify-between items-center border-b border-white/5">
                <h3 className="font-semibold text-lg">Comments</h3>
                <button onClick={() => setExpandedPostId("")} className="text-slate-400 p-1 hover:text-white rounded-full bg-white/5">
                  <span className="material-symbols-outlined">close</span>
                </button>
              </div>
              <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {comments.length === 0 ? (
                  <p className="text-center text-slate-400 mt-10">No comments yet. Be the first to comment!</p>
                ) : (
                  comments.map((comment) => (
                    <div key={comment.id} className="flex gap-3">
                       <div className="w-8 h-8 rounded-full bg-slate-800 overflow-hidden shrink-0 mt-1">
                          <img src={`https://api.dicebear.com/9.x/notionists/svg?seed=${comment.author}`} alt="Avatar" className="w-full h-full object-cover" />
                       </div>
                       <div>
                         <span className="font-semibold text-sm text-slate-200">{comment.author}</span>
                         <p className="text-slate-100 text-sm mt-0.5">{comment.text}</p>
                       </div>
                    </div>
                  ))
                )}
              </div>
              <div className="p-4 border-t border-white/5 bg-[#101822] pb-8">
                <form
                  className="flex gap-2"
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
                >
                  <InputField
                    value={commentDraft}
                    onChange={(e) => setCommentDraft(e.target.value)}
                    className="flex-1 rounded-full bg-white/5 border-transparent focus:bg-white/10"
                    placeholder="Add a comment..."
                  />
                  <PrimaryButton type="submit" className="rounded-full px-6" disabled={isCommenting}>
                    Post
                  </PrimaryButton>
                </form>
              </div>
            </motion.div>
          </>
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
                  const targetPost = posts.find(p => p.id === optionsPostId);
                  const isAuthor = targetPost?.author === user?.username || targetPost?.author === user?.name;
                  
                  if (isAuthor) {
                    return (
                      <button 
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
                    );
                  }
                  
                  return (
                    <button 
                      onClick={() => {
                        toast({ title: "Post Reported", description: "Thanks for keeping the community safe." });
                        setOptionsPostId("");
                      }}
                      className="flex items-center gap-3 text-red-500 hover:bg-white/5 p-4 rounded-2xl transition-colors font-semibold"
                    >
                       <span className="material-symbols-outlined">flag</span> Report Post
                    </button>
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
                    <h3 className="text-white font-bold text-lg">Send a Gift</h3>
                    <div className="flex items-center gap-1 text-amber-400 font-bold bg-amber-400/10 px-3 py-1 rounded-full">
                       <span className="material-symbols-outlined text-sm">monetization_on</span>
                       {user?.coins?.toLocaleString() || "0"}
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-3 gap-3 overflow-y-auto">
                    {[
                      { id: "rose", name: "Rose", cost: 10, icon: "🌹" },
                      { id: "coffee", name: "Coffee", cost: 50, icon: "☕" },
                      { id: "heart", name: "Heart", cost: 100, icon: "💖" },
                      { id: "crown", name: "Crown", cost: 500, icon: "👑" },
                      { id: "rocket", name: "Rocket", cost: 1000, icon: "🚀" },
                      { id: "universe", name: "Universe", cost: 5000, icon: "🌌" },
                    ].map(gift => (
                      <button 
                        key={gift.id}
                        disabled={isGifting}
                        onClick={async () => {
                          try {
                            await sendGift({ postId: giftPostId, amount: gift.cost });
                            if (updateUserSession) {
                              updateUserSession({ coins: (user?.coins || 1000) - gift.cost });
                            }
                            toast({ title: "Gift Sent!", description: `You sent a ${gift.name}!` });
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
                      </button>
                    ))}
                  </div>
  
                </div>
              </motion.div>
            </>
          )}
        </AnimatePresence>
      </div>
    );
  }
