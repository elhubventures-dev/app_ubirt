import { useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { profileShareUrl } from "@/lib/deepLinks";
import { shareContent } from "@/lib/nativeShare";

function qrImageUrl(url) {
  return `https://api.qrserver.com/v1/create-qr-code/?size=240x240&data=${encodeURIComponent(url)}&bgcolor=101822&color=3b82f6&margin=8`;
}

export default function ProfileQRSheet({ open, onClose, username, name }) {
  const shareUrl = useMemo(() => (username ? profileShareUrl(username) : ""), [username]);

  const handleShare = async () => {
    if (!shareUrl) return;
    try {
      const result = await shareContent({
        title: `${name || username} on UBIRT`,
        text: `Follow @${username} on UBIRT`,
        url: shareUrl,
      });
      if (result?.copied) {
        // Caller may toast — keep sheet open.
      }
    } catch {
      // User cancelled share sheet.
    }
  };

  return (
    <AnimatePresence>
      {open ? (
        <>
          <motion.button
            type="button"
            aria-label="Close"
            className="fixed inset-0 z-[90] bg-black/70 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />
          <motion.div
            className="fixed left-4 right-4 bottom-[calc(1rem+env(safe-area-inset-bottom))] z-[100] bg-[#1a2332] border border-white/10 rounded-3xl p-6 shadow-2xl"
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 40 }}
          >
            <div className="text-center">
              <h3 className="text-lg font-bold text-white">Share profile</h3>
              <p className="text-sm text-slate-400 mt-1">Scan to follow @{username}</p>
            </div>

            <div className="flex justify-center my-6">
              <div className="p-3 rounded-2xl bg-[#101822] border border-white/10">
                <img src={qrImageUrl(shareUrl)} alt={`QR code for @${username}`} className="w-60 h-60 rounded-xl" />
              </div>
            </div>

            <p className="text-xs text-slate-500 text-center break-all mb-4">{shareUrl}</p>

            <div className="flex gap-3">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 py-3 rounded-xl bg-white/5 border border-white/10 text-sm font-semibold text-slate-300"
              >
                Close
              </button>
              <button
                type="button"
                onClick={handleShare}
                className="flex-1 py-3 rounded-xl bg-[#3b82f6] text-sm font-semibold text-white"
              >
                Share link
              </button>
            </div>
          </motion.div>
        </>
      ) : null}
    </AnimatePresence>
  );
}
