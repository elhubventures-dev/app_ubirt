import { useState } from "react";
import { motion } from "framer-motion";
import { PrimaryButton } from "@/components/ui/PrimaryButton";
import { InputField } from "@/components/ui/InputField";
import { getSupabase } from "@/lib/supabaseClient";

export default function MfaChallengeModal({ factorId, onSuccess, onCancel }) {
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [isVerifying, setIsVerifying] = useState(false);

  const handleVerify = async (e) => {
    e.preventDefault();
    setIsVerifying(true);
    setError("");
    try {
      const supabase = getSupabase();
      const { data: challenge, error: challengeError } = await supabase.auth.mfa.challenge({ factorId });
      if (challengeError) throw challengeError;

      const { error: verifyError } = await supabase.auth.mfa.verify({
        factorId,
        challengeId: challenge.id,
        code: code.trim(),
      });
      if (verifyError) throw verifyError;
      onSuccess?.();
    } catch (err) {
      setError(err.message || "Invalid code. Try again.");
    } finally {
      setIsVerifying(false);
    }
  };

  return (
    <>
      <motion.div className="fixed inset-0 bg-black/70 z-[400]" initial={{ opacity: 0 }} animate={{ opacity: 1 }} />
      <motion.form
        onSubmit={handleVerify}
        className="fixed left-4 right-4 top-1/2 -translate-y-1/2 z-[401] bg-[#1a2332] border border-white/10 rounded-3xl p-6 shadow-2xl max-w-md mx-auto"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <h3 className="text-lg font-bold text-white mb-1">Two-factor authentication</h3>
        <p className="text-sm text-slate-400 mb-4">Enter the 6-digit code from your authenticator app.</p>
        <InputField
          value={code}
          onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
          placeholder="000000"
          className="text-center tracking-[0.4em] text-lg mb-3"
          autoFocus
          inputMode="numeric"
        />
        {error ? <p className="text-xs text-red-400 mb-3">{error}</p> : null}
        <div className="flex gap-3">
          <button type="button" onClick={onCancel} className="flex-1 py-3 rounded-xl bg-white/10 text-white font-semibold">
            Cancel
          </button>
          <PrimaryButton type="submit" className="flex-1 rounded-xl" disabled={isVerifying || code.length < 6}>
            {isVerifying ? "Verifying..." : "Verify"}
          </PrimaryButton>
        </div>
      </motion.form>
    </>
  );
}

/** Returns TOTP factor id if MFA step-up is required after password sign-in. */
export async function getPendingMfaFactorId() {
  const supabase = getSupabase();
  const { data: aal, error: aalError } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  if (aalError) return null;
  if (aal?.currentLevel === "aal2" || aal?.nextLevel !== "aal2") return null;

  const { data: factors, error } = await supabase.auth.mfa.listFactors();
  if (error) return null;
  const verified = factors?.totp?.find((f) => f.status === "verified");
  return verified?.id ?? null;
}
