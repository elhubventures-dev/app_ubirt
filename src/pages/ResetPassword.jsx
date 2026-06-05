import { useState } from "react";
import { Link, Navigate } from "react-router-dom";
import { useAuth } from "@/lib/AuthContext";
import { PrimaryButton } from "@/components/ui/PrimaryButton";
import { InputField } from "@/components/ui/InputField";
import { useToast } from "@/components/ui/use-toast";
import { isSupabaseConfigured } from "@/lib/supabaseClient";

export default function ResetPassword() {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const { updatePassword, isLiveAuth, isLoadingAuth } = useAuth();
  const { toast } = useToast();

  if (!isSupabaseConfigured()) {
    return <Navigate to="/login" replace />;
  }

  if (!isLoadingAuth && !isLiveAuth) {
    return <Navigate to="/login" replace />;
  }

  const onSubmit = async (e) => {
    e.preventDefault();
    if (password.length < 6) {
      toast({ title: "Password too short", description: "Use at least 6 characters.", variant: "destructive" });
      return;
    }
    if (password !== confirm) {
      toast({ title: "Passwords do not match", variant: "destructive" });
      return;
    }

    setLoading(true);
    try {
      await updatePassword(password);
      toast({ title: "Password updated", description: "You can sign in with your new password." });
    } catch (error) {
      toast({ title: "Update failed", description: error.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[100dvh] bg-[#0a0f16] flex items-center justify-center px-4">
      <div className="w-full max-w-md bg-[#1a2332]/60 backdrop-blur-xl border border-white/10 rounded-[2rem] p-8">
        <h1 className="text-2xl font-bold text-white mb-2">Set new password</h1>
        <p className="text-slate-400 text-sm mb-6">Choose a new password for your UBIRT account.</p>

        <form onSubmit={onSubmit} className="space-y-4">
          <div>
            <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider pl-1 mb-1 block">
              New password
            </label>
            <InputField
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              minLength={6}
              required
              className="w-full bg-[#0a0f16]/50 border-white/5 py-3 px-4 rounded-xl text-white"
            />
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider pl-1 mb-1 block">
              Confirm password
            </label>
            <InputField
              type="password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              minLength={6}
              required
              className="w-full bg-[#0a0f16]/50 border-white/5 py-3 px-4 rounded-xl text-white"
            />
          </div>
          <PrimaryButton type="submit" disabled={loading} className="w-full py-4">
            {loading ? "Saving..." : "Update Password"}
          </PrimaryButton>
        </form>

        <div className="mt-6 text-center">
          <Link to="/login" className="text-sm text-slate-400 hover:text-white">
            Back to sign in
          </Link>
        </div>
      </div>
    </div>
  );
}
