import { createPortal } from "react-dom";
import { motion } from "framer-motion";
import { PrimaryButton } from "@/components/ui/PrimaryButton";
import MentionText from "@/components/feed/MentionText";

export default function CommentsSheet({
  comments = [],
  commentDraft,
  onCommentDraftChange,
  onSubmit,
  onDeleteComment,
  onClose,
  isSubmitting = false,
  isDeleting = false,
  isLoading = false,
}) {
  const content = (
    <>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="fixed inset-0 bg-black/60 z-[200] backdrop-blur-sm"
      />
      <motion.div
        initial={{ y: "100%" }}
        animate={{ y: 0 }}
        exit={{ y: "100%" }}
        transition={{ type: "spring", damping: 25, stiffness: 200 }}
        className="fixed bottom-0 left-0 right-0 z-[201] max-h-[75dvh] bg-[#101822] rounded-t-3xl flex flex-col shadow-2xl border-t border-white/10"
      >
        <div className="flex justify-center p-3 shrink-0">
          <div className="w-12 h-1.5 bg-white/20 rounded-full" />
        </div>
        <div className="px-4 pb-3 flex justify-between items-center border-b border-white/5 shrink-0">
          <h3 className="font-semibold text-lg">Comments</h3>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 p-1 hover:text-white rounded-full bg-white/5"
          >
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto p-4 space-y-4">
          {isLoading ? (
            <p className="text-center text-slate-400 mt-6">Loading comments...</p>
          ) : comments.length === 0 ? (
            <p className="text-center text-slate-400 mt-6">No comments yet. Be the first to comment!</p>
          ) : (
            comments.map((comment) => (
              <div key={comment.id} className="flex gap-3 group">
                <div className="w-8 h-8 rounded-full bg-slate-800 overflow-hidden shrink-0 mt-1">
                  <img
                    src={`https://api.dicebear.com/9.x/notionists/svg?seed=${comment.author}`}
                    alt=""
                    className="w-full h-full object-cover"
                  />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-2">
                    <span className="font-semibold text-sm text-slate-200">{comment.author}</span>
                    {comment.isMine && onDeleteComment ? (
                      <button
                        type="button"
                        disabled={isDeleting}
                        onClick={() => onDeleteComment(comment.id)}
                        className="text-slate-500 hover:text-red-400 opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity disabled:opacity-40 shrink-0 p-1"
                        aria-label="Delete comment"
                      >
                        <span className="material-symbols-outlined text-[18px]">delete</span>
                      </button>
                    ) : null}
                  </div>
                  <p className="text-slate-100 text-sm mt-0.5 break-words">
                    <MentionText text={comment.text} />
                  </p>
                </div>
              </div>
            ))
          )}
        </div>

        <div className="shrink-0 p-4 border-t border-white/10 bg-[#101822] pb-[calc(1rem+env(safe-area-inset-bottom))]">
          <form className="flex items-end gap-2" onSubmit={onSubmit}>
            <textarea
              value={commentDraft}
              onChange={(e) => onCommentDraftChange(e.target.value)}
              placeholder="Add a comment... Use @username to mention"
              rows={1}
              className="flex-1 min-h-[44px] max-h-24 resize-none rounded-2xl bg-white/10 border border-white/10 text-white placeholder:text-slate-500 px-4 py-3 text-sm focus:outline-none focus:border-[#3b82f6]/50"
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  onSubmit(e);
                }
              }}
            />
            <PrimaryButton
              type="submit"
              className="rounded-full px-5 h-11 shrink-0"
              disabled={isSubmitting || !commentDraft.trim()}
            >
              Post
            </PrimaryButton>
          </form>
        </div>
      </motion.div>
    </>
  );

  return createPortal(content, document.body);
}
