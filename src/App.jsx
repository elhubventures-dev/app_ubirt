import { Toaster } from "@/components/ui/toaster";
import { ToastProvider } from "@/components/ui/use-toast";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClientInstance } from "@/lib/query-client";
import { BrowserRouter as Router, Route, Routes, Navigate } from "react-router-dom";
import PageNotFound from "./lib/PageNotFound";
import { AuthProvider, useAuth } from "@/lib/AuthContext";
import UserNotRegisteredError from "@/components/UserNotRegisteredError";
import ErrorBoundary from "@/components/ErrorBoundary";
import MainLayout from "@/components/layout/MainLayout";
import { motion } from "framer-motion";
import Login from "./pages/Login";
import ResetPassword from "./pages/ResetPassword";
import PageTracker from "@/components/PageTracker";
import { usePushNotifications } from "@/hooks/usePushNotifications";
import { useNativeShell } from "@/hooks/useNativeShell";
import { useLastSeenHeartbeat } from "@/hooks/useLastSeenHeartbeat";
import { useRealtimeNotifications } from "@/hooks/useRealtimeNotifications";

import Home from "./pages/Home";
import VideoFeed from "./pages/VideoFeed";
import Messages from "./pages/Messages";
import ChatDetail from "./pages/ChatDetail";
import Profile from "./pages/Profile";
import Notifications from "./pages/Notifications";
import Settings from "./pages/Settings";
import Upload from "./pages/Upload";
import CreatorStudio from "./pages/CreatorStudio";
import Search from "./pages/Search";
import Camera from "./pages/Camera";
import Achievements from "./pages/Achievements";
import Wallet from "./pages/Wallet";
import UserProfile from "./pages/UserProfile";
import FollowList from "./pages/FollowList";
import HashtagFeed from "./pages/HashtagFeed";
import Analytics from "./pages/Analytics";
import CommunityChat from "./pages/CommunityChat";
import JoinGroup from "./pages/JoinGroup";

const LOGO_URL = "/pwa-192x192.png";

/** Always mounted so OAuth deep links work from /login. */
function NativeBootstrap() {
  useNativeShell();
  return null;
}

const AuthenticatedApp = () => {
  const { user, isLoadingAuth, isLoadingPublicSettings, authError, isLiveAuth, retryAuth } = useAuth();

  usePushNotifications();
  useLastSeenHeartbeat();
  useRealtimeNotifications();

  if (isLoadingPublicSettings || isLoadingAuth) {
    return (
      <div className="fixed inset-0 flex flex-col items-center justify-center bg-[#101822] gap-6">
        <motion.img
          src={LOGO_URL}
          alt="UBIRT.AI"
          className="w-24 h-24 object-contain rounded-2xl"
          animate={{ opacity: [0.6, 1, 0.6] }}
          transition={{ duration: 2, repeat: Infinity }}
        />
        <div className="text-center">
          <p className="text-white text-3xl font-bold tracking-widest">
            UBIRT<span className="text-[#0d5bba]">.AI</span>
          </p>
          <p className="text-slate-500 text-xs tracking-widest mt-1 uppercase">
            Advanced Intelligence Solutions
          </p>
        </div>
        <div className="w-48 h-1 bg-slate-800 rounded-full overflow-hidden">
          <motion.div
            className="h-full bg-[#0d5bba] rounded-full"
            animate={{ width: ["0%", "100%"] }}
            transition={{ duration: 2, ease: "easeInOut", repeat: Infinity }}
          />
        </div>
      </div>
    );
  }

  if (authError?.type === "user_not_registered") return <UserNotRegisteredError />;
  if (authError?.type === "auth_required" && isLiveAuth && !user) {
    return <Navigate to="/login" replace />;
  }
  if (authError?.type === "auth_error") {
    return (
      <div className="fixed inset-0 flex flex-col items-center justify-center bg-[#101822] gap-4 px-6 text-center">
        <span className="material-symbols-outlined text-[48px] text-red-500">error</span>
        <h2 className="text-white text-xl font-bold">Authentication Error</h2>
        <p className="text-slate-400 text-sm">{authError.message}</p>
        <div className="flex flex-col sm:flex-row gap-3 mt-4">
          <button
            type="button"
            onClick={() => retryAuth()}
            className="px-6 py-2 bg-[#3b82f6] text-white rounded-full font-bold"
          >
            Retry
          </button>
          <button
            type="button"
            onClick={() => window.location.assign("/login")}
            className="px-6 py-2 bg-white/10 text-white rounded-full font-bold"
          >
            Back to sign in
          </button>
        </div>
      </div>
    );
  }

  return (
    <Routes>
      <Route element={<MainLayout />}>
        <Route path="/" element={<Home />} />
        <Route path="/feed" element={<VideoFeed />} />
        <Route path="/messages" element={<Messages />} />
        <Route path="/ai-chat" element={<Navigate to="/" replace />} />
        <Route path="/profile" element={<Profile />} />
        <Route path="/notifications" element={<Notifications />} />
        <Route path="/search" element={<Search />} />
      </Route>

      <Route path="/chat/:id" element={<ChatDetail />} />
      <Route path="/group/join/:code" element={<JoinGroup />} />
      <Route path="/group/:id" element={<CommunityChat />} />
      <Route path="/community/:id" element={<CommunityChat />} />
      <Route path="/settings" element={<Settings />} />
      <Route path="/upload" element={<Upload />} />
      <Route path="/create" element={<Camera />} />
      <Route path="/creator-studio" element={<CreatorStudio />} />
      <Route path="/achievements" element={<Achievements />} />
      <Route path="/wallet" element={<Wallet />} />
      <Route path="/analytics" element={<Analytics />} />
      <Route path="/user/:username/followers" element={<FollowList />} />
      <Route path="/user/:username/following" element={<FollowList />} />
      <Route path="/user/:username" element={<UserProfile />} />
      <Route path="/tag/:tag" element={<HashtagFeed />} />

      <Route path="*" element={<PageNotFound />} />
    </Routes>
  );
};

function App() {
  return (
    <ErrorBoundary>
      <Router>
        <AuthProvider>
          <NativeBootstrap />
          <PageTracker />
          <ToastProvider>
            <QueryClientProvider client={queryClientInstance}>
              <Routes>
                <Route path="/login" element={<Login />} />
                <Route path="/reset-password" element={<ResetPassword />} />
                <Route path="/*" element={<AuthenticatedApp />} />
              </Routes>
              <Toaster />
            </QueryClientProvider>
          </ToastProvider>
        </AuthProvider>
      </Router>
    </ErrorBoundary>
  );
}

export default App;
