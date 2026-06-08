import { motion } from "framer-motion";
import { PrimaryButton } from "@/components/ui/PrimaryButton";

export default function IncomingCallSheet({ session, onAccept, onDecline, isBusy }) {
  const isVideo = session.callType === "video";

  return (
    <>
      <motion.div
        className="fixed inset-0 bg-black/80 z-[500] backdrop-blur-md"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
      />
      <motion.div
        className="fixed inset-x-4 top-[20%] z-[501] bg-[#1a2332] border border-white/10 rounded-3xl p-8 text-center shadow-2xl max-w-md mx-auto"
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <div className="w-20 h-20 rounded-full bg-[#3b82f6]/20 flex items-center justify-center mx-auto mb-4 animate-pulse">
          <span className="material-symbols-outlined text-[40px] text-[#3b82f6]">
            {isVideo ? "videocam" : "call"}
          </span>
        </div>
        <h2 className="text-xl font-bold text-white mb-1">
          Incoming {isVideo ? "video" : "audio"} call
        </h2>
        <p className="text-sm text-slate-400 mb-8">Tap accept to join</p>
        <div className="flex gap-3">
          <button
            type="button"
            disabled={isBusy}
            onClick={onDecline}
            className="flex-1 py-3.5 rounded-2xl bg-red-500/20 text-red-400 font-semibold border border-red-500/30"
          >
            Decline
          </button>
          <PrimaryButton className="flex-1 rounded-2xl py-3.5" disabled={isBusy} onClick={onAccept}>
            Accept
          </PrimaryButton>
        </div>
      </motion.div>
    </>
  );
}
