import { useState } from "react";
import { motion } from "framer-motion";
import { PrimaryButton } from "@/components/ui/PrimaryButton";
import { InputField } from "@/components/ui/InputField";

/**
 * Clerk email OTP modal — enter the 6-digit code sent after signup/signin.
 */
export default function EmailVerificationModal({
  email,
  onVerify,
  onResend,
  onCancel,
}) {
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [isVerifying, setIsVerifying] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const [resent, setResent] = useState(false);

  const handleVerify = async (e) => {
    e.preventDefault();
    setIsVerifying(true);
    setError("");
    try {
      await onVerify?.(code.trim());
    } catch (err) {
      setError(err.message || "Invalid code. Try again.");
    } finally {
      setIsVerifying(false);
    }
  };

  const handleResend = async () => {
    setIsResending(true);
    setError("");
    setResent(false);
    try {
      await onResend?.();
      setResent(true);
    } catch (err) {
      setError(err.message || "Could not resend the code.");
    } finally {
      setIsResending(false);
    }
  };

  return (
    <>
      <motion.div
        className="fixed inset-0 bg-black/70 z-[400]"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
      />
      <motion.form
        onSubmit={handleVerify}
        className="fixed left-4 right-4 top-1/2 -translate-y-1/2 z-[401] bg-[#1a2332] border border-white/10 rounded-3xl p-6 shadow-2xl max-w-md mx-auto"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <h3 className="text-lg font-bold text-white mb-1">Verify your email</h3>
        <p className="text-sm text-slate-400 mb-4">
          Enter the 6-digit code we sent to{" "}
          <span className="text-white font-medium">{email || "your email"}</span>.
        </p>
        <InputField
          value={code}
          onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
          placeholder="000000"
          className="text-center tracking-[0.4em] text-lg mb-3 bg-[#0a0f16]/50 border-white/5 text-white"
          autoFocus
          inputMode="numeric"
          autoComplete="one-time-code"
        />
        {error ? <p className="text-xs text-red-400 mb-3">{error}</p> : null}
        {resent && !error ? (
          <p className="text-xs text-emerald-400 mb-3">A new code was sent.</p>
        ) : null}
        <div className="flex gap-3 mb-3">
          <button
            type="button"
            onClick={onCancel}
            className="flex-1 py-3 rounded-xl bg-white/10 text-white font-semibold"
          >
            Cancel
          </button>
          <PrimaryButton
            type="submit"
            className="flex-1 rounded-xl"
            disabled={isVerifying || code.length < 6}
          >
            {isVerifying ? "Verifying..." : "Verify"}
          </PrimaryButton>
        </div>
        <button
          type="button"
          onClick={handleResend}
          disabled={isResending}
          className="w-full text-sm text-[#3b82f6] hover:text-[#2563eb] font-medium disabled:opacity-60"
        >
          {isResending ? "Sending…" : "Resend code"}
        </button>
      </motion.form>
    </>
  );
}
