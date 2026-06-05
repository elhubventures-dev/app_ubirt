import { useState } from "react";
import { Link, Navigate } from "react-router-dom";
import { useAuth } from "@/lib/AuthContext";
import { PrimaryButton } from "@/components/ui/PrimaryButton";
import { InputField } from "@/components/ui/InputField";
import { useToast } from "@/components/ui/use-toast";
import { isLiveMode, isSupabaseConfigured } from "@/lib/supabaseClient";
import { motion, AnimatePresence } from "framer-motion";

export default function Login() {
  const [mode, setMode] = useState("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [username, setUsername] = useState("");
  const [loading, setLoading] = useState(false);
  const { user, signIn, signUp, signInWithGoogle, signInWithApple, resetPassword, isLiveAuth, isLoadingAuth } = useAuth();
  const { toast } = useToast();

  if (user && isLiveAuth && !isLoadingAuth) {
    return <Navigate to="/" replace />;
  }

  const onGoogleSignIn = async () => {
    setLoading(true);
    try {
      await signInWithGoogle();
    } catch (error) {
      toast({
        title: "Google sign-in failed",
        description: error.message,
        variant: "destructive",
      });
      setLoading(false);
    }
  };

  const onAppleSignIn = async () => {
    setLoading(true);
    try {
      await signInWithApple();
    } catch (error) {
      toast({
        title: "Apple sign-in failed",
        description: error.message,
        variant: "destructive",
      });
      setLoading(false);
    }
  };

  const onSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (mode === "forgot") {
        await resetPassword(email.trim());
        toast({
          title: "Check your email",
          description: "We sent a password reset link if that account exists.",
        });
        setMode("signin");
        return;
      }
      if (mode === "signin") {
        await signIn(email.trim(), password);
        toast({ title: "Welcome back" });
      } else {
        await signUp(email.trim(), password, username.trim());
        toast({ title: "Account created", description: "You're signed in." });
      }
    } catch (error) {
      const needsConfirm = error.message?.includes("Check your email");
      toast({
        title: needsConfirm ? "Confirm your email" : "Auth failed",
        description: error.message,
        variant: needsConfirm ? "default" : "destructive",
      });
      if (needsConfirm) setMode("signin");
    } finally {
      setLoading(false);
    }
  };

  const isMock = !isLiveMode() || !isSupabaseConfigured();

  return (
    <div className="min-h-[100dvh] w-full bg-[#0a0f16] flex items-center justify-center relative overflow-hidden px-4">
      {/* Immersive Background */}
      <div className="absolute inset-0 z-0">
        <motion.div 
          animate={{ scale: [1, 1.1, 1], opacity: [0.4, 0.6, 0.4] }}
          transition={{ duration: 10, repeat: Infinity, ease: "easeInOut" }}
          className="absolute top-[-10%] left-[-20%] w-[70%] h-[70%] bg-[#3b82f6]/20 blur-[150px] rounded-full"
        />
        <motion.div 
          animate={{ scale: [1, 1.2, 1], opacity: [0.3, 0.5, 0.3] }}
          transition={{ duration: 15, repeat: Infinity, ease: "easeInOut", delay: 2 }}
          className="absolute bottom-[-20%] right-[-10%] w-[60%] h-[80%] bg-[#8b5cf6]/20 blur-[150px] rounded-full"
        />
        <div className="absolute inset-0 bg-[#0a0f16]/40 backdrop-blur-[50px]" />
      </div>

      {/* Auth Card */}
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: "easeOut" }}
        className="w-full max-w-md bg-[#1a2332]/60 backdrop-blur-xl border border-white/10 rounded-[2rem] p-8 shadow-2xl relative z-10"
      >
        <div className="text-center mb-8">
           <div className="w-16 h-16 bg-[#3b82f6]/10 rounded-2xl mx-auto mb-4 flex items-center justify-center border border-[#3b82f6]/20 shadow-[0_0_15px_rgba(59,130,246,0.3)]">
             <img src="/pwa-192x192.png" className="w-full h-full object-contain rounded-2xl" alt="UBIRT" />
           </div>
           <h1 className="text-3xl font-bold tracking-tight text-white mb-1">
             UBIRT<span className="text-[#3b82f6]">.AI</span>
           </h1>
           <p className="text-slate-400 text-sm font-medium">
             {isMock
               ? "Mock Mode Active"
               : mode === "forgot"
                 ? "We'll email you a reset link."
                 : mode === "signin"
                   ? "Welcome back, creator."
                   : "Join the next generation of creators."}
           </p>
        </div>

        {isMock ? (
           <div className="text-center py-4">
              <p className="text-yellow-500/90 text-sm bg-yellow-500/10 p-3 rounded-xl border border-yellow-500/20 mb-6">
                Set <code>VITE_DATA_PROVIDER=live</code> and Supabase environment variables to enable real login.
              </p>
              <Link to="/" className="w-full inline-flex justify-center items-center py-3.5 px-4 rounded-xl bg-[#3b82f6] text-white font-semibold shadow-[0_4px_14px_rgba(59,130,246,0.4)] hover:bg-[#2563eb] hover:-translate-y-0.5 transition-all">
                 Continue to App <span className="material-symbols-outlined text-[18px] ml-1.5">arrow_forward</span>
              </Link>
           </div>
        ) : (
          <>
            {mode !== "forgot" && (
            <>
            <button
              type="button"
              disabled={loading}
              onClick={onGoogleSignIn}
              className="w-full flex items-center justify-center gap-3 py-3.5 px-4 rounded-xl bg-white text-slate-900 font-semibold hover:bg-slate-100 transition-colors disabled:opacity-60"
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24" aria-hidden="true">
                <path
                  fill="#4285F4"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                />
                <path
                  fill="#34A853"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                />
                <path
                  fill="#EA4335"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                />
              </svg>
              Continue with Google
            </button>

            <button
              type="button"
              disabled={loading}
              onClick={onAppleSignIn}
              className="w-full flex items-center justify-center gap-3 py-3.5 px-4 rounded-xl bg-black text-white font-semibold border border-white/20 hover:bg-white/10 transition-colors disabled:opacity-60 mt-3"
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                <path d="M17.05 20.28c-.98.95-2.05.8-3.08.35-1.09-.46-2.09-.48-3.24 0-1.44.62-2.2.44-3.06-.35C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z" />
              </svg>
              Continue with Apple
            </button>
            </>
            )}

            {mode !== "forgot" && (
            <div className="relative my-6">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-white/10" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-[#1a2332]/60 px-3 text-slate-500">or with email</span>
              </div>
            </div>
            )}

            <form onSubmit={onSubmit} className="space-y-4">
             <AnimatePresence mode="popLayout">
               {mode === "signup" && (
                 <motion.div
                   initial={{ opacity: 0, height: 0, scale: 0.95 }}
                   animate={{ opacity: 1, height: "auto", scale: 1 }}
                   exit={{ opacity: 0, height: 0, scale: 0.95 }}
                   transition={{ duration: 0.2 }}
                 >
                   <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider pl-1 mb-1 block">Username</label>
                   <InputField
                     value={username}
                     onChange={(e) => setUsername(e.target.value)}
                     placeholder="@creator"
                     required
                     className="w-full bg-[#0a0f16]/50 border-white/5 py-3 px-4 rounded-xl focus:bg-[#0a0f16]/80 focus:border-[#3b82f6]/50 transition-all text-white placeholder-slate-500"
                   />
                 </motion.div>
               )}
             </AnimatePresence>
             
             <div>
               <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider pl-1 mb-1 block">Email</label>
               <InputField
                 type="email"
                 value={email}
                 onChange={(e) => setEmail(e.target.value)}
                 placeholder="name@example.com"
                 required
                 className="w-full bg-[#0a0f16]/50 border-white/5 py-3 px-4 rounded-xl focus:bg-[#0a0f16]/80 focus:border-[#3b82f6]/50 transition-all text-white placeholder-slate-500"
               />
             </div>
             
             {mode !== "forgot" && (
               <>
                 <div>
                   <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider pl-1 mb-1 block">Password</label>
                   <InputField
                     type="password"
                     value={password}
                     onChange={(e) => setPassword(e.target.value)}
                     placeholder="••••••••"
                     required
                     minLength={6}
                     className="w-full bg-[#0a0f16]/50 border-white/5 py-3 px-4 rounded-xl focus:bg-[#0a0f16]/80 focus:border-[#3b82f6]/50 transition-all text-white placeholder-slate-500"
                   />
                 </div>

                 {mode === "signin" && (
                   <div className="text-right -mt-2">
                     <button
                       type="button"
                       className="text-xs text-[#3b82f6] hover:text-[#2563eb] font-medium"
                       onClick={() => setMode("forgot")}
                     >
                       Forgot password?
                     </button>
                   </div>
                 )}
               </>
             )}
             
             <PrimaryButton type="submit" disabled={loading} className="w-full py-4 rounded-xl text-base font-semibold shadow-[0_4px_14px_rgba(59,130,246,0.3)] hover:-translate-y-0.5 transition-transform mt-2">
               {mode === "signin" ? "Sign In" : mode === "forgot" ? "Send Reset Link" : "Create Account"}
             </PrimaryButton>
          </form>
          </>
        )}

        {!isMock && (
          <div className="mt-8 text-center">
            <button
              type="button"
              className="text-sm text-slate-400 hover:text-white transition-colors"
              onClick={() => {
                 if (mode === "forgot") {
                   setMode("signin");
                 } else {
                   setMode(mode === "signin" ? "signup" : "signin");
                 }
                 setEmail("");
                 setPassword("");
                 setUsername("");
              }}
            >
              {mode === "forgot"
                ? "Back to sign in"
                : mode === "signin"
                  ? "Don't have an account? Sign up"
                  : "Already have an account? Sign in"}
            </button>
          </div>
        )}
      </motion.div>
    </div>
  );
}
