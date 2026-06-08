import { useEffect, useState } from "react";
import { getSupabase } from "@/lib/supabaseClient";
import { PrimaryButton } from "@/components/ui/PrimaryButton";
import { InputField } from "@/components/ui/InputField";
import { useToast } from "@/components/ui/use-toast";

export default function MfaSettings() {
  const { toast } = useToast();
  const [factors, setFactors] = useState([]);
  const [enrolling, setEnrolling] = useState(false);
  const [qrCode, setQrCode] = useState("");
  const [factorId, setFactorId] = useState("");
  const [verifyCode, setVerifyCode] = useState("");
  const [isBusy, setIsBusy] = useState(false);

  const loadFactors = async () => {
    const supabase = getSupabase();
    const { data, error } = await supabase.auth.mfa.listFactors();
    if (error) {
      console.warn("MFA list failed:", error.message);
      return;
    }
    setFactors(data?.totp ?? []);
  };

  useEffect(() => {
    loadFactors();
  }, []);

  const startEnroll = async () => {
    setIsBusy(true);
    try {
      const supabase = getSupabase();
      const { data, error } = await supabase.auth.mfa.enroll({
        factorType: "totp",
        friendlyName: "Authenticator app",
      });
      if (error) throw error;
      setFactorId(data.id);
      setQrCode(data.totp?.qr_code ?? "");
      setEnrolling(true);
    } catch (error) {
      toast({ title: "Could not start 2FA setup", description: error.message, variant: "destructive" });
    } finally {
      setIsBusy(false);
    }
  };

  const finishEnroll = async () => {
    setIsBusy(true);
    try {
      const supabase = getSupabase();
      const { data: challenge, error: challengeError } = await supabase.auth.mfa.challenge({ factorId });
      if (challengeError) throw challengeError;
      const { error } = await supabase.auth.mfa.verify({
        factorId,
        challengeId: challenge.id,
        code: verifyCode.trim(),
      });
      if (error) throw error;
      toast({ title: "Two-factor enabled", description: "Your account now requires an authenticator code at sign-in." });
      setEnrolling(false);
      setVerifyCode("");
      setQrCode("");
      await loadFactors();
    } catch (error) {
      toast({ title: "Verification failed", description: error.message, variant: "destructive" });
    } finally {
      setIsBusy(false);
    }
  };

  const disableFactor = async (id) => {
    setIsBusy(true);
    try {
      const supabase = getSupabase();
      const { error } = await supabase.auth.mfa.unenroll({ factorId: id });
      if (error) throw error;
      toast({ title: "Two-factor disabled" });
      await loadFactors();
    } catch (error) {
      toast({ title: "Could not disable 2FA", description: error.message, variant: "destructive" });
    } finally {
      setIsBusy(false);
    }
  };

  const verified = factors.filter((f) => f.status === "verified");

  return (
    <div className="space-y-3">
      {verified.length ? (
        verified.map((factor) => (
          <div key={factor.id} className="p-4 bg-white/5 border border-white/10 rounded-2xl flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-white">{factor.friendly_name || "Authenticator app"}</p>
              <p className="text-xs text-emerald-400 mt-1">Active</p>
            </div>
            <button
              type="button"
              disabled={isBusy}
              onClick={() => disableFactor(factor.id)}
              className="text-xs font-semibold text-red-400 hover:text-red-300"
            >
              Disable
            </button>
          </div>
        ))
      ) : enrolling ? (
        <div className="p-4 bg-white/5 border border-white/10 rounded-2xl space-y-3">
          <p className="text-sm text-slate-300">Scan this QR code with Google Authenticator, 1Password, or Authy.</p>
          {qrCode ? (
            <img src={qrCode} alt="TOTP QR code" className="w-44 h-44 mx-auto rounded-xl bg-white p-2" />
          ) : null}
          <InputField
            value={verifyCode}
            onChange={(e) => setVerifyCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
            placeholder="Enter 6-digit code"
            className="text-center tracking-widest"
          />
          <PrimaryButton className="w-full rounded-xl" disabled={isBusy || verifyCode.length < 6} onClick={finishEnroll}>
            {isBusy ? "Verifying..." : "Confirm 2FA"}
          </PrimaryButton>
          <button type="button" onClick={() => setEnrolling(false)} className="w-full text-sm text-slate-400">
            Cancel
          </button>
        </div>
      ) : (
        <PrimaryButton variant="secondary" className="w-full rounded-xl" disabled={isBusy} onClick={startEnroll}>
          Enable authenticator app (2FA)
        </PrimaryButton>
      )}
    </div>
  );
}
