import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import MfaSettings from "@/components/safety/MfaSettings";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/components/ui/use-toast";
import { useAuth } from "@/lib/AuthContext";
import { PrimaryButton } from "@/components/ui/PrimaryButton";
import { InputField } from "@/components/ui/InputField";
import { getDataMode, dataProvider } from "@/api/dataProvider";
import { getPreference, setPreference } from "@/lib/preferences";
import { isBiometricLockEnabled, setBiometricLockEnabled } from "@/components/mobile/BiometricGate";
import { BiometricAuth } from "@aparajita/capacitor-biometric-auth";
import { DEFAULT_NOTIFICATION_PREFS } from "@/lib/notificationPreferences";
import { ALLOWED_IMAGE_ACCEPT, validateImageFile } from "@/lib/uploadPolicy";
import { getSupabase, isSupabaseConfigured } from "@/lib/supabaseClient";
import { Capacitor } from "@capacitor/core";
import { getProfileCoverUrl } from "@/lib/profileDefaults";
import { motion } from "framer-motion";

function Toggle({ checked, onChange, label }) {
  return (
    <div
      className="flex items-center justify-between p-4 bg-white/5 border border-white/5 rounded-2xl hover:bg-white/10 transition-colors cursor-pointer"
      onClick={() => onChange(!checked)}
    >
      <span className="text-sm font-medium text-slate-200">{label}</span>
      <div className={`w-12 h-6 rounded-full relative transition-colors ${checked ? "bg-[#3b82f6]" : "bg-slate-700"}`}>
        <motion.div
          layout
          transition={{ type: "spring", stiffness: 700, damping: 30 }}
          className="w-5 h-5 bg-white rounded-full absolute top-0.5 shadow-sm"
          style={{ left: checked ? "calc(100% - 1.35rem)" : "0.15rem" }}
        />
      </div>
    </div>
  );
}

function SectionTitle({ children }) {
  return (
    <h2 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3 px-1">{children}</h2>
  );
}

function FieldLabel({ children, hint }) {
  return (
    <div className="mb-1.5 pl-1">
      <label className="text-xs font-semibold text-slate-400 block">{children}</label>
      {hint ? <p className="text-[10px] text-slate-500 mt-0.5">{hint}</p> : null}
    </div>
  );
}

export default function Settings() {
  const {
    user,
    signOut,
    signOutAllSessions,
    deleteAccount,
    isLiveAuth,
    updateUserSession,
    changeEmail,
    changePassword,
  } = useAuth();
  const [autoplay, setAutoplay] = useState(() => getPreference("autoplay", true));
  const [notifications, setNotifications] = useState(() => getPreference("push", true));
  const [haptics, setHaptics] = useState(() => getPreference("haptics", true));
  const [biometricLock, setBiometricLock] = useState(() => isBiometricLockEnabled());
  const [notifPrefs, setNotifPrefs] = useState({ ...DEFAULT_NOTIFICATION_PREFS });
  const [isSavingNotifPrefs, setIsSavingNotifPrefs] = useState(false);

  const [name, setName] = useState("");
  const [username, setUsername] = useState("");
  const [bio, setBio] = useState("");
  const [phone, setPhone] = useState("");
  const [website, setWebsite] = useState("");
  const [location, setLocation] = useState("");
  const [avatarFile, setAvatarFile] = useState(null);
  const [coverFile, setCoverFile] = useState(null);

  const [email, setEmail] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [hasEmailAuth, setHasEmailAuth] = useState(false);

  const { toast } = useToast();
  const queryClient = useQueryClient();
  const avatarInputRef = useRef(null);
  const coverInputRef = useRef(null);

  const { data: ownProfile, isLoading: isLoadingProfile } = useQuery({
    queryKey: ["own-profile", user?.id],
    queryFn: () => dataProvider.getOwnProfile(),
    enabled: Boolean(user?.id),
  });

  const { data: savedNotifPrefs } = useQuery({
    queryKey: ["notification-preferences"],
    queryFn: () => dataProvider.getNotificationPreferences(),
    enabled: Boolean(user?.id),
  });

  const { data: showReadReceipts = true } = useQuery({
    queryKey: ["show-read-receipts"],
    queryFn: () => dataProvider.getShowReadReceipts?.() ?? true,
    enabled: Boolean(user?.id),
  });

  const [isSavingReadReceipts, setIsSavingReadReceipts] = useState(false);

  useEffect(() => {
    if (savedNotifPrefs) setNotifPrefs(savedNotifPrefs);
  }, [savedNotifPrefs]);

  useEffect(() => {
    if (!user) return;
    setName(user.name || "");
    setUsername(user.username || "");
    setBio(user.bio || "");
    setPhone(user.phone || "");
    setWebsite(user.website || "");
    setLocation(user.location || "");
    setEmail(user.email || "");
  }, [user]);

  useEffect(() => {
    if (!ownProfile) return;
    setName(ownProfile.name || "");
    setUsername(ownProfile.username || "");
    setBio(ownProfile.bio || "");
    setPhone(ownProfile.phone || "");
    setWebsite(ownProfile.website || "");
    setLocation(ownProfile.location || "");
  }, [ownProfile]);

  useEffect(() => {
    if (!isLiveAuth || !isSupabaseConfigured()) return;
    getSupabase()
      .auth.getUser()
      .then(({ data: { user: authUser } }) => {
        setHasEmailAuth(Boolean(authUser?.identities?.some((i) => i.provider === "email")));
      })
      .catch(() => setHasEmailAuth(false));
  }, [isLiveAuth]);

  const toggleAutoplay = (next) => {
    setAutoplay(next);
    setPreference("autoplay", next);
    toast({ title: "Preference saved", description: `Autoplay ${next ? "enabled" : "disabled"}.` });
  };

  const togglePush = (next) => {
    setNotifications(next);
    setPreference("push", next);
    const enabledDescription = Capacitor.isNativePlatform()
      ? "Native push will register on this device."
      : "On web, notifications appear in-app while the tab is open. Native push works in the mobile app.";
    toast({
      title: "Push preference saved",
      description: next ? enabledDescription : "Push notifications disabled in preferences.",
    });
  };

  const toggleHaptics = (next) => {
    setHaptics(next);
    setPreference("haptics", next);
    toast({ title: "Haptics updated", description: next ? "Feedback enabled for likes and messages." : "Haptic feedback disabled." });
  };

  const toggleBiometricLock = async (next) => {
    if (!Capacitor.isNativePlatform()) {
      toast({ title: "Native only", description: "App lock requires the iOS or Android app.", variant: "destructive" });
      return;
    }
    if (next) {
      try {
        const info = await BiometricAuth.checkBiometry();
        if (!info.isAvailable) {
          toast({ title: "Unavailable", description: "Biometrics are not set up on this device.", variant: "destructive" });
          return;
        }
        await BiometricAuth.authenticate({ reason: "Confirm Face ID or fingerprint for app lock" });
      } catch (error) {
        toast({ title: "Could not enable", description: error.message || "Authentication cancelled.", variant: "destructive" });
        return;
      }
    }
    setBiometricLock(next);
    setBiometricLockEnabled(next);
    toast({
      title: next ? "App lock enabled" : "App lock disabled",
      description: next ? "UBIRT will ask for biometrics when you return to the app." : "App opens without extra authentication.",
    });
  };

  const toggleNotifPref = async (key, next) => {
    const updated = { ...notifPrefs, [key]: next };
    setNotifPrefs(updated);
    setIsSavingNotifPrefs(true);
    try {
      await dataProvider.updateNotificationPreferences(updated);
      queryClient.invalidateQueries({ queryKey: ["notification-preferences"] });
    } catch (error) {
      setNotifPrefs(notifPrefs);
      toast({ title: "Could not save", description: error.message, variant: "destructive" });
    } finally {
      setIsSavingNotifPrefs(false);
    }
  };

  const toggleReadReceipts = async (next) => {
    if (!dataProvider.updateShowReadReceipts) return;
    setIsSavingReadReceipts(true);
    try {
      await dataProvider.updateShowReadReceipts(next);
      queryClient.setQueryData(["show-read-receipts"], next);
      toast({
        title: "Read receipts updated",
        description: next ? "Others can see when you've read their messages." : "Read receipts are hidden from others.",
      });
    } catch (error) {
      toast({ title: "Could not save", description: error.message, variant: "destructive" });
    } finally {
      setIsSavingReadReceipts(false);
    }
  };

  const { data: isAdmin = false } = useQuery({
    queryKey: ["is-admin"],
    queryFn: () => dataProvider.getIsAdmin(),
    enabled: isLiveAuth,
  });

  const { data: walletAudit = [] } = useQuery({
    queryKey: ["wallet-audit"],
    queryFn: () => dataProvider.getWalletAuditLog(20),
    enabled: isLiveAuth,
  });
  const [isSaving, setIsSaving] = useState(false);
  const [isSavingEmail, setIsSavingEmail] = useState(false);
  const [isSavingPassword, setIsSavingPassword] = useState(false);
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
      const updated = await dataProvider.updateProfile({
        name,
        username,
        bio,
        phone,
        website,
        location,
        coverFile,
      });
      updateUserSession({
        name: updated.name ?? name,
        username: updated.username ?? username,
        avatar: updated.avatar ?? user?.avatar,
        cover: updated.cover ?? user?.cover,
        bio: updated.bio ?? bio,
        phone: updated.phone ?? phone,
        website: updated.website ?? website,
        location: updated.location ?? location,
      });
      setAvatarFile(null);
      setCoverFile(null);
      queryClient.invalidateQueries({ queryKey: ["own-profile"] });
      queryClient.invalidateQueries({ queryKey: ["public-profile"] });
      queryClient.invalidateQueries({ queryKey: ["creator-stats"] });
      toast({ title: "Profile updated", description: "Your changes have been saved." });
    } catch (error) {
      toast({ title: "Update failed", description: error.message, variant: "destructive" });
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveEmail = async (e) => {
    e.preventDefault();
    if (!isLiveAuth) {
      toast({ title: "Demo mode", description: "Email changes require a live account." });
      return;
    }
    if (!email.trim() || email.trim() === user?.email) {
      toast({ title: "No change", description: "Enter a new email address." });
      return;
    }
    setIsSavingEmail(true);
    try {
      await changeEmail(email);
      toast({
        title: "Confirmation sent",
        description: "Check your inbox to confirm your new email address.",
      });
    } catch (error) {
      toast({ title: "Email update failed", description: error.message, variant: "destructive" });
    } finally {
      setIsSavingEmail(false);
    }
  };

  const handleSavePassword = async (e) => {
    e.preventDefault();
    if (!isLiveAuth) {
      toast({ title: "Demo mode", description: "Password changes require a live account." });
      return;
    }
    if (newPassword.length < 8) {
      toast({ title: "Password too short", description: "Use at least 8 characters.", variant: "destructive" });
      return;
    }
    if (newPassword !== confirmPassword) {
      toast({ title: "Passwords don't match", description: "Confirm your new password.", variant: "destructive" });
      return;
    }
    if (hasEmailAuth && !currentPassword) {
      toast({ title: "Current password required", variant: "destructive" });
      return;
    }
    setIsSavingPassword(true);
    try {
      await changePassword(currentPassword, newPassword);
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      toast({ title: "Password updated", description: "Your password has been changed." });
    } catch (error) {
      toast({ title: "Password update failed", description: error.message, variant: "destructive" });
    } finally {
      setIsSavingPassword(false);
    }
  };

  const avatarPreview = avatarFile
    ? URL.createObjectURL(avatarFile)
    : user?.avatar || `https://api.dicebear.com/9.x/notionists/svg?seed=${user?.username || "default"}`;
  const coverPreview = coverFile
    ? URL.createObjectURL(coverFile)
    : getProfileCoverUrl(ownProfile?.cover || user?.cover);

  return (
    <div className="flex flex-col h-[100dvh] bg-[#0a0f16] text-white overflow-hidden relative">
      <div className="absolute top-[20%] left-[-10%] w-[50%] h-[40%] bg-[#8b5cf6]/10 blur-[120px] rounded-full pointer-events-none z-0" />

      <header className="shrink-0 px-4 py-4 bg-[#101822]/80 backdrop-blur-xl border-b border-white/5 flex items-center justify-between z-10 shadow-sm">
        <Link
          to="/profile"
          className="text-[#3b82f6] flex items-center gap-1 hover:bg-white/5 rounded-full p-1.5 -ml-1.5 transition-colors"
        >
          <span className="material-symbols-outlined text-[24px]">arrow_back_ios</span>
        </Link>
        <h1 className="text-base font-bold tracking-wide absolute left-1/2 -translate-x-1/2">Edit Profile</h1>
        <div className="w-8" />
      </header>

      <div className="flex-1 overflow-y-auto hide-scrollbar relative z-10">
        <div className="px-4 py-6 max-w-2xl mx-auto space-y-8">
          {isLoadingProfile && isLiveAuth ? (
            <p className="text-center text-slate-400 text-sm py-4">Loading profile...</p>
          ) : null}

          {/* Profile photo & about */}
          <section>
            <SectionTitle>Profile</SectionTitle>
            <form onSubmit={handleSaveProfile} className="bg-white/5 border border-white/10 p-5 rounded-3xl backdrop-blur-sm space-y-4">
              <div>
                <FieldLabel hint="JPG or PNG, recommended 1200×400">Cover image</FieldLabel>
                <label className="block relative h-28 rounded-2xl overflow-hidden border border-white/10 cursor-pointer group">
                  <img src={coverPreview} alt="Cover" className="w-full h-full object-cover" />
                  <div className="absolute inset-0 bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                    <span className="material-symbols-outlined text-white text-[24px]">photo_camera</span>
                  </div>
                  <input
                    ref={coverInputRef}
                    type="file"
                    accept={ALLOWED_IMAGE_ACCEPT}
                    className="hidden"
                    onChange={(e) => {
                      const selected = e.target.files?.[0];
                      if (!selected) return;
                      try {
                        validateImageFile(selected);
                        setCoverFile(selected);
                      } catch (error) {
                        toast({ title: "Invalid file", description: error.message, variant: "destructive" });
                      }
                    }}
                  />
                </label>
                <PrimaryButton
                  type="button"
                  variant="secondary"
                  size="sm"
                  className="mt-2"
                  onClick={() => coverInputRef.current?.click()}
                >
                  Change cover
                </PrimaryButton>
              </div>

              <div className="flex items-center gap-4">
                <label className="w-20 h-20 rounded-full bg-slate-800 border-2 border-white/10 overflow-hidden relative group cursor-pointer block shrink-0">
                  <img src={avatarPreview} alt="Avatar" className="w-full h-full object-cover" />
                  <div className="absolute inset-0 bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                    <span className="material-symbols-outlined text-[20px] text-white">edit</span>
                  </div>
                  <input
                    ref={avatarInputRef}
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
                  <PrimaryButton type="button" variant="secondary" size="sm" onClick={() => avatarInputRef.current?.click()}>
                    Change photo
                  </PrimaryButton>
                  <p className="text-[10px] text-slate-500 mt-2">JPG or PNG only</p>
                </div>
              </div>

              <div>
                <FieldLabel hint={`${bio.length}/160 characters`}>Bio</FieldLabel>
                <textarea
                  value={bio}
                  onChange={(e) => setBio(e.target.value.slice(0, 160))}
                  rows={3}
                  placeholder="Tell people about yourself..."
                  className="w-full rounded-xl px-3 py-2.5 bg-[#0a0f16]/50 border border-white/10 text-white placeholder:text-slate-500 text-sm resize-none focus:outline-none focus:border-[#3b82f6]/50"
                />
              </div>

              <div>
                <FieldLabel>Display name</FieldLabel>
                <InputField value={name} onChange={(e) => setName(e.target.value)} className="w-full bg-[#0a0f16]/50 border-white/5" placeholder="Your name" />
              </div>

              <div>
                <FieldLabel hint="Letters, numbers, and underscores only">Username</FieldLabel>
                <InputField value={username} onChange={(e) => setUsername(e.target.value)} className="w-full bg-[#0a0f16]/50 border-white/5" placeholder="username" />
              </div>

              <div>
                <FieldLabel>Location</FieldLabel>
                <InputField value={location} onChange={(e) => setLocation(e.target.value)} className="w-full bg-[#0a0f16]/50 border-white/5" placeholder="City, Country" />
              </div>

              <div>
                <FieldLabel>Website</FieldLabel>
                <InputField value={website} onChange={(e) => setWebsite(e.target.value)} className="w-full bg-[#0a0f16]/50 border-white/5" placeholder="https://yoursite.com" />
              </div>

              <div>
                <FieldLabel>Phone number</FieldLabel>
                <InputField
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="w-full bg-[#0a0f16]/50 border-white/5"
                  placeholder="+1 555 000 0000"
                />
              </div>

              <PrimaryButton type="submit" className="w-full" disabled={isSaving}>
                {isSaving ? "Saving..." : "Save profile"}
              </PrimaryButton>
            </form>
          </section>

          {/* Account security */}
          <section>
            <SectionTitle>Account & security</SectionTitle>
            <div className="space-y-4">
              <form onSubmit={handleSaveEmail} className="bg-white/5 border border-white/10 p-5 rounded-3xl space-y-3">
                <FieldLabel hint="We'll send a confirmation link to your new address">Email</FieldLabel>
                <InputField
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full bg-[#0a0f16]/50 border-white/5"
                  placeholder="you@example.com"
                  disabled={!isLiveAuth}
                />
                <PrimaryButton type="submit" variant="secondary" className="w-full" disabled={isSavingEmail || !isLiveAuth}>
                  {isSavingEmail ? "Sending..." : "Update email"}
                </PrimaryButton>
              </form>

              <form onSubmit={handleSavePassword} className="bg-white/5 border border-white/10 p-5 rounded-3xl space-y-3">
                <FieldLabel>
                  {hasEmailAuth ? "Change password" : "Set password"}
                </FieldLabel>
                {hasEmailAuth ? (
                  <InputField
                    type="password"
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    className="w-full bg-[#0a0f16]/50 border-white/5"
                    placeholder="Current password"
                    autoComplete="current-password"
                    disabled={!isLiveAuth}
                  />
                ) : (
                  <p className="text-xs text-slate-500 pl-1">
                    You signed in with Google or Apple. Set a password to also sign in with email.
                  </p>
                )}
                <InputField
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full bg-[#0a0f16]/50 border-white/5"
                  placeholder="New password (min. 8 characters)"
                  autoComplete="new-password"
                  disabled={!isLiveAuth}
                />
                <InputField
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full bg-[#0a0f16]/50 border-white/5"
                  placeholder="Confirm new password"
                  autoComplete="new-password"
                  disabled={!isLiveAuth}
                />
                <PrimaryButton type="submit" variant="secondary" className="w-full" disabled={isSavingPassword || !isLiveAuth}>
                  {isSavingPassword ? "Updating..." : hasEmailAuth ? "Change password" : "Set password"}
                </PrimaryButton>
              </form>
            </div>
          </section>

          {/* Preferences */}
          <section>
            <SectionTitle>App preferences</SectionTitle>
            <div className="space-y-2">
              <Toggle checked={autoplay} onChange={toggleAutoplay} label="Autoplay feed posts" />
              <Toggle checked={notifications} onChange={togglePush} label="Push notifications (device)" />
              <Toggle checked={haptics} onChange={toggleHaptics} label="Haptic feedback" />
              {Capacitor.isNativePlatform() ? (
                <Toggle checked={biometricLock} onChange={toggleBiometricLock} label="Face ID / fingerprint app lock" />
              ) : null}
            </div>
          </section>

          <section>
            <SectionTitle>Privacy</SectionTitle>
            <div className="space-y-2">
              <Toggle
                checked={showReadReceipts}
                onChange={toggleReadReceipts}
                label="Show read receipts"
              />
              <p className="text-xs text-slate-500 px-1">
                When off, others won&apos;t see when you&apos;ve read their DMs.
                {isSavingReadReceipts ? " Saving..." : ""}
              </p>
            </div>
          </section>

          <section>
            <SectionTitle>Notification types</SectionTitle>
            <p className="text-xs text-slate-500 px-1 mb-2">
              Synced to your account. In-app alerts respect these settings.
              {isSavingNotifPrefs ? " Saving..." : ""}
            </p>
            <div className="space-y-2">
              <Toggle
                checked={notifPrefs.inApp}
                onChange={(next) => toggleNotifPref("inApp", next)}
                label="In-app alerts & sounds"
              />
              <Toggle
                checked={notifPrefs.messages}
                onChange={(next) => toggleNotifPref("messages", next)}
                label="Messages"
              />
              <Toggle
                checked={notifPrefs.likes}
                onChange={(next) => toggleNotifPref("likes", next)}
                label="Likes"
              />
              <Toggle
                checked={notifPrefs.comments}
                onChange={(next) => toggleNotifPref("comments", next)}
                label="Comments"
              />
              <Toggle
                checked={notifPrefs.follows}
                onChange={(next) => toggleNotifPref("follows", next)}
                label="New followers"
              />
              <Toggle
                checked={notifPrefs.gifts}
                onChange={(next) => toggleNotifPref("gifts", next)}
                label="Gifts"
              />
              <Toggle
                checked={notifPrefs.mentions !== false}
                onChange={(next) => toggleNotifPref("mentions", next)}
                label="Mentions & reposts"
              />
            </div>
          </section>

          {isLiveAuth ? (
            <section>
              <SectionTitle>Two-factor authentication</SectionTitle>
              <MfaSettings />
            </section>
          ) : null}

          {isLiveAuth ? (
            <section>
              <SectionTitle>Sessions</SectionTitle>
              <div className="space-y-2">
                <button
                  type="button"
                  onClick={async () => {
                    try {
                      await signOutAllSessions();
                      toast({ title: "Signed out everywhere", description: "All active sessions were revoked." });
                    } catch (error) {
                      toast({ title: "Could not sign out", description: error.message, variant: "destructive" });
                    }
                  }}
                  className="w-full p-4 bg-white/5 border border-white/10 rounded-2xl text-left hover:bg-white/10 transition-colors"
                >
                  <p className="text-sm font-semibold text-white">Log out all devices</p>
                  <p className="text-xs text-slate-400 mt-1">Revoke sessions on other phones and browsers.</p>
                </button>
              </div>
            </section>
          ) : null}

          {isLiveAuth && walletAudit.length ? (
            <section>
              <SectionTitle>Wallet activity log</SectionTitle>
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {walletAudit.map((entry) => (
                  <div key={entry.id} className="p-3 bg-white/5 border border-white/10 rounded-xl text-xs">
                    <div className="flex justify-between gap-2">
                      <span className="font-semibold text-white capitalize">{entry.action.replace(/_/g, " ")}</span>
                      <span className={entry.amount >= 0 ? "text-emerald-400" : "text-red-400"}>
                        {entry.amount >= 0 ? "+" : ""}
                        {entry.amount} {entry.walletType}
                      </span>
                    </div>
                    <p className="text-slate-500 mt-1">{new Date(entry.createdAt).toLocaleString()}</p>
                  </div>
                ))}
              </div>
            </section>
          ) : null}

          {isAdmin ? (
            <section>
              <SectionTitle>Admin</SectionTitle>
              <Link
                to="/admin/moderation"
                className="flex items-center justify-between p-4 bg-violet-500/10 border border-violet-500/20 rounded-2xl hover:bg-violet-500/20 transition-colors"
              >
                <span className="text-sm font-medium text-violet-200">Moderation queue</span>
                <span className="material-symbols-outlined text-violet-300 text-[20px]">shield</span>
              </Link>
            </section>
          ) : null}

          <section>
            <SectionTitle>Legal</SectionTitle>
            <div className="space-y-2">
              <Link
                to="/privacy"
                className="flex items-center justify-between p-4 bg-white/5 border border-white/5 rounded-2xl hover:bg-white/10 transition-colors"
              >
                <span className="text-sm font-medium text-slate-200">Privacy Policy</span>
                <span className="material-symbols-outlined text-slate-400 text-[20px]">chevron_right</span>
              </Link>
              <Link
                to="/terms"
                className="flex items-center justify-between p-4 bg-white/5 border border-white/5 rounded-2xl hover:bg-white/10 transition-colors"
              >
                <span className="text-sm font-medium text-slate-200">Terms of Service</span>
                <span className="material-symbols-outlined text-slate-400 text-[20px]">chevron_right</span>
              </Link>
            </div>
          </section>

          {/* Danger zone */}
          <section>
            <SectionTitle>Danger zone</SectionTitle>
            <div className="bg-red-500/5 border border-red-500/10 p-5 rounded-3xl space-y-3">
              <p className="text-sm text-slate-300">
                Data mode: <span className="font-mono text-xs">{getDataMode()}</span>
              </p>
              {isLiveAuth && (
                <PrimaryButton variant="danger" className="w-full" onClick={() => signOut()}>
                  Sign out
                </PrimaryButton>
              )}
              <button
                type="button"
                onClick={handleDeleteAccount}
                disabled={isDeleting}
                className="w-full py-3 text-sm font-semibold text-red-400 hover:bg-red-500/10 rounded-xl transition-colors border border-transparent hover:border-red-500/20 disabled:opacity-60"
              >
                {isDeleting ? "Deleting..." : "Delete account"}
              </button>
            </div>
          </section>

          <div className="h-10" />
        </div>
      </div>
    </div>
  );
}
