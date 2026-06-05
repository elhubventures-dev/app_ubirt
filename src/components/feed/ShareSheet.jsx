import { motion } from "framer-motion";
import { useToast } from "@/components/ui/use-toast";

export default function ShareSheet({ post, onClose }) {
  const { toast } = useToast();
  const shareUrl = `${window.location.origin}/feed?post=${post?.id ?? ""}`;
  const shareText = post?.caption
    ? `Check out this post on UBIRT: ${post.caption.slice(0, 80)}`
    : "Check out this post on UBIRT";

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      toast({ title: "Link copied", description: "Share it anywhere you like." });
      onClose();
    } catch {
      toast({ title: "Copy failed", variant: "destructive" });
    }
  };

  const nativeShare = async () => {
    if (!navigator.share) {
      await copyLink();
      return;
    }
    try {
      await navigator.share({ title: "UBIRT", text: shareText, url: shareUrl });
      onClose();
    } catch (error) {
      if (error?.name !== "AbortError") {
        toast({ title: "Share failed", description: error.message, variant: "destructive" });
      }
    }
  };

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
        className="absolute bottom-0 left-0 right-0 bg-[#101822] rounded-t-3xl z-50 flex flex-col shadow-2xl border-t border-white/10 p-6 pb-10"
      >
        <div className="w-12 h-1.5 bg-white/20 rounded-full mx-auto mb-6" />
        <h3 className="font-semibold text-lg text-white mb-4">Share post</h3>
        <div className="grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={nativeShare}
            className="flex flex-col items-center gap-2 p-4 rounded-2xl bg-white/5 hover:bg-white/10 transition-colors"
          >
            <span className="material-symbols-outlined text-[28px] text-[#3b82f6]">share</span>
            <span className="text-sm font-semibold text-white">Share</span>
          </button>
          <button
            type="button"
            onClick={copyLink}
            className="flex flex-col items-center gap-2 p-4 rounded-2xl bg-white/5 hover:bg-white/10 transition-colors"
          >
            <span className="material-symbols-outlined text-[28px] text-emerald-400">link</span>
            <span className="text-sm font-semibold text-white">Copy link</span>
          </button>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="mt-6 w-full py-3 rounded-xl bg-white/10 text-white font-semibold hover:bg-white/20"
        >
          Cancel
        </button>
      </motion.div>
    </>
  );
}
