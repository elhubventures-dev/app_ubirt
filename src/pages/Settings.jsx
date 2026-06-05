import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useToast } from "@/components/ui/use-toast";
import { useAuth } from "@/lib/AuthContext";
import { PrimaryButton } from "@/components/ui/PrimaryButton";
import { InputField } from "@/components/ui/InputField";
import { getDataMode, dataProvider } from "@/api/dataProvider";
import { getPreference, setPreference } from "@/lib/preferences";
import { ALLOWED_IMAGE_ACCEPT, validateImageFile } from "@/lib/uploadPolicy";
import { motion } from "framer-motion";

function Toggle({ checked, onChange, label }) {
  return (
    <div className="flex items-center justify-between p-4 bg-white/5 border border-white/5 rounded-2xl hover:bg-white/10 transition-colors cursor-pointer" onClick={() => onChange(!checked)}>
       <span className="text-sm font-medium text-slate-200">{label}</span>
       <div className={`w-12 h-6 rounded-full relative transition-colors ${checked ? 'bg-[#3b82f6]' : 'bg-slate-700'}`}>
          <motion.div 
             layout 
             transition={{ type: "spring", stiffness: 700, damping: 30 }}
             className="w-5 h-5 bg-white rounded-full absolute top-0.5 shadow-sm"
             style={{ left: checked ? 'calc(100% - 1.35rem)' : '0.15rem' }}
          />
       </div>
    </div>
  );
}

export default function Settings() {
  const { user, signOut, deleteAccount, isLiveAuth, updateUserSession } = useAuth();
  const [autoplay, setAutoplay] = useState(() => getPreference("autoplay", true));
  const [aiAssist, setAiAssist] = useState(() => getPreference("aiAssist", true));
  const [notifications, setNotifications] = useState(() => getPreference("push", true));
  
  const [name, setName] = useState("");
  const [username, setUsername] = useState("");
  const [avatarFile, setAvatarFile] = useState(null);
  
  const { toast } = useToast();

  useEffect(() => {
    if (!user) return;
    setName(user.name || "");
    setUsername(user.username || "");
  }, [user]);

  const toggleAutoplay = (next) => {
    setAutoplay(next);
    setPreference("autoplay", next);
    toast({ title: "Preference saved", description: `Autoplay ${next ? "enabled" : "disabled"}.` });
  };

  const toggleAiAssist = (next) => {
    setAiAssist(next);
    setPreference("aiAssist", next);
    toast({ title: "Preference saved", description: `AI assist ${next ? "enabled" : "disabled"}.` });
  };

  const togglePush = (next) => {
    setNotifications(next);
    setPreference("push", next);
    toast({
      title: "Push preference saved",
      description: next
        ? "Native push will register when you use the mobile app."
        : "Push notifications disabled in preferences.",
    });
  };

  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const handleDeleteAccount = async () => {
    const confirmed = window.confirm(
      "Delete your account permanently? This cannot be undone and removes your profile, posts, and wallet data."
    );
    if (!confirmed) return;
    setIsDeleting(true);
    try {
      await deleteAccount();
      toast({ title: "Account deleted", description: "Your account has been removed." });
    } catch (error) {
      toast({ title: "Delete failed", description: error.message, variant: "destructive" });
    } finally {
      setIsDeleting(false);
    }
  };

  const handleSaveProfile = async (e) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      const updated = await dataProvider.updateProfile(name, username, avatarFile);
      updateUserSession({
        name: updated.name ?? name,
        username: updated.username ?? username,
        avatar: updated.avatar ?? user?.avatar,
      });
      setAvatarFile(null);
      toast({ title: "Profile updated", description: "Your changes have been saved." });
    } catch (error) {
      toast({ title: "Update failed", description: error.message, variant: "destructive" });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="flex flex-col h-[100dvh] bg-[#0a0f16] text-white overflow-hidden relative">
      {/* Background aesthetics */}
      <div className="absolute top-[20%] left-[-10%] w-[50%] h-[40%] bg-[#8b5cf6]/10 blur-[120px] rounded-full pointer-events-none z-0" />

      {/* Header */}
      <header className="shrink-0 px-4 py-4 bg-[#101822]/80 backdrop-blur-xl border-b border-white/5 flex items-center justify-between z-10 shadow-sm">
        <Link to="/profile" className="text-[#3b82f6] flex items-center gap-1 hover:bg-white/5 rounded-full p-1.5 -ml-1.5 transition-colors">
          <span className="material-symbols-outlined text-[24px]">arrow_back_ios</span>
        </Link>
        <h1 className="text-base font-bold tracking-wide absolute left-1/2 -translate-x-1/2">Settings</h1>
        <div className="w-8" />
      </header>

      {/* Scrollable Content */}
      <div className="flex-1 overflow-y-auto hide-scrollbar relative z-10">
        <div className="px-4 py-6 max-w-2xl mx-auto space-y-8">
          
          {/* Profile Section */}
          <section>
            <h2 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3 px-1">Profile Customization</h2>
            <form onSubmit={handleSaveProfile} className="bg-white/5 border border-white/10 p-5 rounded-3xl backdrop-blur-sm space-y-4">
               <div className="flex items-center gap-4 mb-2">
                 <label className="w-16 h-16 rounded-full bg-slate-800 border-2 border-white/10 overflow-hidden relative group cursor-pointer block">
                    <img src={avatarFile ? URL.createObjectURL(avatarFile) : (user?.avatar || `https://api.dicebear.com/9.x/notionists/svg?seed=${user?.username || "default"}`)} alt="Avatar" className="w-full h-full object-cover" />
                    <div className="absolute inset-0 bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                       <span className="material-symbols-outlined text-[20px] text-white">edit</span>
                    </div>
                    <input
                      type="file"
                      accept={ALLOWED_IMAGE_ACCEPT}
                      className="hidden"
                      onChange={(e) => {
                        const selected = e.target.files?.[0];
                        if (!selected) return;
                        try {
                          validateImageFile(selected);
                          setAvatarFile(selected);
                        } catch (error) {
                          toast({ title: "Invalid file", description: error.message, variant: "destructive" });
                        }
                      }}
                    />
                 </label>
                 <div>
                    <label className="cursor-pointer block">
                      <PrimaryButton type="button" variant="secondary" size="sm" onClick={() => document.querySelector('input[type="file"]').click()}>Change Avatar</PrimaryButton>
                    </label>
                 </div>
               </div>
               
               <div>
                  <label className="text-xs font-semibold text-slate-400 block mb-1.5 pl-1">Username</label>
                  <InputField value={username} onChange={(e) => setUsername(e.target.value)} className="w-full bg-[#0a0f16]/50 border-white/5" placeholder="username" />
               </div>
               
               <div>
                  <label className="text-xs font-semibold text-slate-400 block mb-1.5 pl-1">Display Name</label>
                  <InputField value={name} onChange={(e) => setName(e.target.value)} className="w-full bg-[#0a0f16]/50 border-white/5" placeholder="Your Name" />
               </div>

               <div className="pt-2">
                 <PrimaryButton type="submit" className="w-full" disabled={isSaving}>
                   {isSaving ? "Saving..." : "Save Changes"}
                 </PrimaryButton>
               </div>
            </form>
          </section>

          {/* Preferences Section */}
          <section>
            <h2 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3 px-1">App Preferences</h2>
            <div className="space-y-2">
               <Toggle checked={autoplay} onChange={toggleAutoplay} label="Autoplay feed posts" />
               <Toggle checked={aiAssist} onChange={toggleAiAssist} label="AI assistance in composer" />
               <Toggle checked={notifications} onChange={togglePush} label="Push Notifications" />
            </div>
          </section>

          {/* Danger Zone */}
          <section>
            <h2 className="text-xs font-bold text-red-400 uppercase tracking-wider mb-3 px-1">Danger Zone</h2>
            <div className="bg-red-500/5 border border-red-500/10 p-5 rounded-3xl space-y-3">
               <p className="text-sm text-slate-300">Data mode: <span className="font-mono text-xs">{getDataMode()}</span></p>
               {isLiveAuth && (
                 <PrimaryButton variant="danger" className="w-full" onClick={() => signOut()}>
                   Sign Out
                 </PrimaryButton>
               )}
               <button
                 type="button"
                 onClick={handleDeleteAccount}
                 disabled={isDeleting}
                 className="w-full py-3 text-sm font-semibold text-red-400 hover:bg-red-500/10 rounded-xl transition-colors border border-transparent hover:border-red-500/20 disabled:opacity-60"
               >
                 {isDeleting ? "Deleting..." : "Delete Account"}
               </button>
            </div>
          </section>
          
          <div className="h-10" />
        </div>
      </div>
    </div>
  );
}
