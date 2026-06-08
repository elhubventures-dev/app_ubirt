import { useState } from "react";
import { PrimaryButton } from "@/components/ui/PrimaryButton";
import { dataProvider } from "@/api/dataProvider";
import { useAuth } from "@/lib/AuthContext";

export default function AgeGateModal({ onConfirmed }) {
  const { isLiveAuth } = useAuth();
  const [confirmed, setConfirmed] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState("");

  const handleConfirm = async () => {
    if (!confirmed) {
      setError("Please confirm you are at least 13 years old.");
      return;
    }
    setIsSaving(true);
    setError("");
    try {
      if (isLiveAuth && dataProvider.confirmAgeGate) {
        await dataProvider.confirmAgeGate();
      } else {
        localStorage.setItem("ubirt.pref.ageConfirmed", "true");
      }
      onConfirmed?.();
    } catch (err) {
      setError(err.message || "Could not save confirmation.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[250] bg-[#101822] flex items-center justify-center p-6">
      <div className="max-w-md w-full bg-[#1a2332] border border-white/10 rounded-3xl p-6 shadow-2xl">
        <span className="material-symbols-outlined text-[#3b82f6] text-[40px] mb-4">verified_user</span>
        <h2 className="text-xl font-bold text-white mb-2">Age confirmation</h2>
        <p className="text-sm text-slate-400 mb-5">
          UBIRT is for users aged 13 and older. By continuing, you confirm that you meet this requirement and agree to
          follow our community guidelines.
        </p>

        <label className="flex items-start gap-3 p-4 rounded-2xl bg-white/5 border border-white/10 mb-4 cursor-pointer">
          <input
            type="checkbox"
            checked={confirmed}
            onChange={(e) => setConfirmed(e.target.checked)}
            className="mt-1"
          />
          <span className="text-sm text-slate-200">I confirm that I am at least 13 years old.</span>
        </label>

        {error ? <p className="text-xs text-red-400 mb-3">{error}</p> : null}

        <PrimaryButton className="w-full rounded-xl py-3" onClick={handleConfirm} disabled={isSaving}>
          {isSaving ? "Saving..." : "Continue to UBIRT"}
        </PrimaryButton>
      </div>
    </div>
  );
}
