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
  const { user, signIn, signUp, isLiveAuth, isLoadingAuth } = useAuth();
  const { toast } = useToast();

  if (user && isLiveAuth && !isLoadingAuth) {
    return <Navigate to="/" replace />;
  }

  const onSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
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
             {isMock ? "Mock Mode Active" : mode === "signin" ? "Welcome back, creator." : "Join the next generation of creators."}
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
             
             <PrimaryButton type="submit" disabled={loading} className="w-full py-4 rounded-xl text-base font-semibold shadow-[0_4px_14px_rgba(59,130,246,0.3)] hover:-translate-y-0.5 transition-transform mt-2">
               {mode === "signin" ? "Sign In" : "Create Account"}
             </PrimaryButton>
          </form>
        )}

        {!isMock && (
          <div className="mt-8 text-center">
            <button
              type="button"
              className="text-sm text-slate-400 hover:text-white transition-colors"
              onClick={() => {
                 setMode(mode === "signin" ? "signup" : "signin");
                 setEmail("");
                 setPassword("");
                 setUsername("");
              }}
            >
              {mode === "signin" ? "Don't have an account? Sign up" : "Already have an account? Sign in"}
            </button>
          </div>
        )}
      </motion.div>
    </div>
  );
}
