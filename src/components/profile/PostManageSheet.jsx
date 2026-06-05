import { createPortal } from "react-dom";
import { motion } from "framer-motion";
import { PrimaryButton } from "@/components/ui/PrimaryButton";
import { InputField } from "@/components/ui/InputField";

export default function PostManageSheet({
  upload,
  title,
  description,
  onTitleChange,
  onDescriptionChange,
  onClose,
  onSave,
  onDelete,
  onPublish,
  isSaving = false,
  isDeleting = false,
  isPublishing = false,
}) {
  if (!upload) return null;

  const thumb = upload.media_url || `https://api.dicebear.com/9.x/shapes/svg?seed=${upload.id}`;

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
        className="fixed bottom-0 left-0 right-0 z-[201] max-h-[85dvh] bg-[#101822] rounded-t-3xl flex flex-col shadow-2xl border-t border-white/10"
      >
        <div className="flex justify-center p-3 shrink-0">
          <div className="w-12 h-1.5 bg-white/20 rounded-full" />
        </div>

        <div className="px-4 pb-3 flex justify-between items-center border-b border-white/5 shrink-0">
          <h3 className="font-semibold text-lg">Manage Post</h3>
          <button type="button" onClick={onClose} className="text-slate-400 p-1 hover:text-white rounded-full bg-white/5">
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto p-4 space-y-4">
          <div className="aspect-[4/5] max-h-48 mx-auto rounded-2xl overflow-hidden bg-slate-800 ring-1 ring-white/10">
            <img src={thumb} alt={title || "Post"} className="w-full h-full object-cover" />
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1 block">Title</label>
            <InputField
              value={title}
              onChange={(e) => onTitleChange(e.target.value)}
              placeholder="Post title"
              className="rounded-xl bg-white/5 border-white/10"
            />
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1 block">Caption</label>
            <textarea
              value={description}
              onChange={(e) => onDescriptionChange(e.target.value)}
              placeholder="Write a caption..."
              rows={3}
              className="w-full rounded-xl bg-white/5 border border-white/10 text-white placeholder:text-slate-500 px-4 py-3 text-sm focus:outline-none focus:border-[#3b82f6]/50 resize-none"
            />
          </div>

          <p className="text-xs text-slate-500 capitalize">
            Status: <span className="text-slate-300">{upload.status ?? "draft"}</span>
          </p>
        </div>

        <div className="shrink-0 p-4 border-t border-white/10 space-y-2 pb-[calc(1rem+env(safe-area-inset-bottom))]">
          <PrimaryButton className="w-full rounded-full" onClick={onSave} disabled={isSaving || !title.trim()}>
            {isSaving ? "Saving..." : "Save Changes"}
          </PrimaryButton>

          {(upload.status ?? "draft") === "draft" && onPublish && (
            <PrimaryButton
              variant="secondary"
              className="w-full rounded-full"
              onClick={onPublish}
              disabled={isPublishing}
            >
              {isPublishing ? "Publishing..." : "Publish to Feed"}
            </PrimaryButton>
          )}

          <button
            type="button"
            onClick={onDelete}
            disabled={isDeleting}
            className="w-full py-3 text-sm font-semibold text-red-400 hover:bg-red-500/10 rounded-full border border-red-500/20 disabled:opacity-60"
          >
            {isDeleting ? "Deleting..." : "Delete Post"}
          </button>
        </div>
      </motion.div>
    </>
  );

  return createPortal(content, document.body);
}
