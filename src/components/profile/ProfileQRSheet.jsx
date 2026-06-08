import { useMemo, useLayoutEffect, useState, useCallback } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { profileShareUrl } from "@/lib/deepLinks";
import { shareContent } from "@/lib/nativeShare";

function qrImageUrl(url) {
  return `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(url)}&bgcolor=101822&color=3b82f6&margin=8`;
}

function getAnchorPosition(anchor) {
  const rect = anchor.getBoundingClientRect();
  return {
    top: rect.top - 8,
    left: rect.left + rect.width / 2,
  };
}

export default function ProfileQRSheet({ open, onClose, username, name, anchorRef }) {
  const shareUrl = useMemo(() => (username ? profileShareUrl(username) : ""), [username]);
  const [position, setPosition] = useState(null);

  const updatePosition = useCallback(() => {
    if (!anchorRef?.current) return;
    setPosition(getAnchorPosition(anchorRef.current));
  }, [anchorRef]);

  useLayoutEffect(() => {
    if (!open) {
      setPosition(null);
      return;
    }
    updatePosition();
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);
    return () => {
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
    };
  }, [open, updatePosition]);

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

  if (typeof document === "undefined") return null;

  return createPortal(
    <AnimatePresence>
      {open && position ? (
        <>
          <motion.button
            type="button"
            aria-label="Close"
            className="fixed inset-0 z-[90] bg-black/50 backdrop-blur-[2px]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />
          <motion.div
            className="fixed z-[100] w-[min(18rem,calc(100vw-2rem))] bg-[#1a2332] border border-white/10 rounded-2xl p-4 shadow-2xl"
            style={{
              top: position.top,
              left: position.left,
              transform: "translate(-50%, -100%)",
            }}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 8 }}
          >
            <div className="text-center">
              <h3 className="text-sm font-bold text-white">Share profile</h3>
              <p className="text-xs text-slate-400 mt-0.5">Scan to follow @{username}</p>
            </div>

            <div className="flex justify-center my-4">
              <div className="p-2 rounded-xl bg-[#101822] border border-white/10">
                <img src={qrImageUrl(shareUrl)} alt={`QR code for @${username}`} className="w-44 h-44 rounded-lg" />
              </div>
            </div>

            <p className="text-[10px] text-slate-500 text-center break-all mb-3 line-clamp-2">{shareUrl}</p>

            <div className="flex gap-2">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 py-2.5 rounded-xl bg-white/5 border border-white/10 text-xs font-semibold text-slate-300"
              >
                Close
              </button>
              <button
                type="button"
                onClick={handleShare}
                className="flex-1 py-2.5 rounded-xl bg-[#3b82f6] text-xs font-semibold text-white"
              >
                Share link
              </button>
            </div>
          </motion.div>
        </>
      ) : null}
    </AnimatePresence>,
    document.body,
  );
}
