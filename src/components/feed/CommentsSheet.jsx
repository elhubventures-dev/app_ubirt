import { motion } from "framer-motion";
import { PrimaryButton } from "@/components/ui/PrimaryButton";
import { InputField } from "@/components/ui/InputField";

export default function CommentsSheet({
  comments = [],
  commentDraft,
  onCommentDraftChange,
  onSubmit,
  onClose,
  isSubmitting = false,
}) {
  return (
    <>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
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
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 p-1 hover:text-white rounded-full bg-white/5"
          >
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
                  <img
                    src={`https://api.dicebear.com/9.x/notionists/svg?seed=${comment.author}`}
                    alt=""
                    className="w-full h-full object-cover"
                  />
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
          <form className="flex gap-2" onSubmit={onSubmit}>
            <InputField
              value={commentDraft}
              onChange={(e) => onCommentDraftChange(e.target.value)}
              className="flex-1 rounded-full bg-white/5 border-transparent focus:bg-white/10"
              placeholder="Add a comment..."
            />
            <PrimaryButton type="submit" className="rounded-full px-6" disabled={isSubmitting}>
              Post
            </PrimaryButton>
          </form>
        </div>
      </motion.div>
    </>
  );
}
