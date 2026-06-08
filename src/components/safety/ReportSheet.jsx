import { useState } from "react";
import { motion } from "framer-motion";
import { PrimaryButton } from "@/components/ui/PrimaryButton";

const REASONS = [
  "Spam or misleading",
  "Harassment or bullying",
  "Hate speech",
  "Violence or dangerous content",
  "Nudity or sexual content",
  "Intellectual property violation",
  "Other",
];

export default function ReportSheet({ targetType, targetId, onSubmit, onClose }) {
  const [reason, setReason] = useState(REASONS[0]);
  const [details, setDetails] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      await onSubmit({ targetType, targetId, reason, details: details.trim() || null });
      onClose();
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="fixed inset-0 bg-black/60 z-[300] backdrop-blur-sm"
      />
      <motion.form
        initial={{ y: "100%" }}
        animate={{ y: 0 }}
        exit={{ y: "100%" }}
        onSubmit={handleSubmit}
        className="fixed bottom-0 left-0 right-0 z-[301] bg-[#101822] rounded-t-3xl border-t border-white/10 p-6 pb-[calc(1.5rem+env(safe-area-inset-bottom))] shadow-2xl"
      >
        <div className="w-12 h-1.5 bg-white/20 rounded-full mx-auto mb-5" />
        <h3 className="text-lg font-bold text-white mb-1">Report content</h3>
        <p className="text-sm text-slate-400 mb-4">Our team reviews reports within 24–48 hours.</p>

        <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2 block">
          Reason
        </label>
        <select
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          className="w-full rounded-xl bg-white/5 border border-white/10 text-white px-4 py-3 mb-4 focus:outline-none focus:border-[#3b82f6]/50"
        >
          {REASONS.map((item) => (
            <option key={item} value={item} className="bg-[#101822]">
              {item}
            </option>
          ))}
        </select>

        <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2 block">
          Additional details (optional)
        </label>
        <textarea
          value={details}
          onChange={(e) => setDetails(e.target.value)}
          rows={3}
          placeholder="Tell us more..."
          className="w-full rounded-xl bg-white/5 border border-white/10 text-white placeholder:text-slate-500 px-4 py-3 mb-5 resize-none focus:outline-none focus:border-[#3b82f6]/50"
        />

        <div className="flex gap-3">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 py-3 rounded-xl bg-white/10 text-white font-semibold hover:bg-white/20"
          >
            Cancel
          </button>
          <PrimaryButton type="submit" className="flex-1 rounded-xl" disabled={isSubmitting}>
            {isSubmitting ? "Submitting..." : "Submit report"}
          </PrimaryButton>
        </div>
      </motion.form>
    </>
  );
}
