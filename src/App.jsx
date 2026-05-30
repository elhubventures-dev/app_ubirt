import { Toaster } from "@/components/ui/toaster";
import { ToastProvider } from "@/components/ui/use-toast";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClientInstance } from "@/lib/query-client";
import { BrowserRouter as Router, Route, Routes, Navigate } from "react-router-dom";
import PageNotFound from "./lib/PageNotFound";
import { AuthProvider, useAuth } from "@/lib/AuthContext";
import UserNotRegisteredError from "@/components/UserNotRegisteredError";
import MainLayout from "@/components/layout/MainLayout";
import { motion } from "framer-motion";
import Login from "./pages/Login";

import Home from "./pages/Home";
import VideoFeed from "./pages/VideoFeed";
import Messages from "./pages/Messages";
import ChatDetail from "./pages/ChatDetail";
import AIChat from "./pages/AIChat";
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
import HashtagFeed from "./pages/HashtagFeed";

const LOGO_URL =
  "https://images.unsplash.com/photo-1545239351-1141bd82e8a6?w=160&h=160&fit=crop";

const AuthenticatedApp = () => {
  const { isLoadingAuth, isLoadingPublicSettings, authError, isLiveAuth } = useAuth();

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
  if (authError?.type === "auth_required" && isLiveAuth) {
    return <Navigate to="/login" replace />;
  }

  return (
    <Routes>
      <Route element={<MainLayout />}>
        <Route path="/" element={<Home />} />
        <Route path="/feed" element={<VideoFeed />} />
        <Route path="/messages" element={<Messages />} />
        <Route path="/ai-chat" element={<AIChat />} />
        <Route path="/profile" element={<Profile />} />
        <Route path="/notifications" element={<Notifications />} />
        <Route path="/search" element={<Search />} />
      </Route>

      <Route path="/chat/:id" element={<ChatDetail />} />
      <Route path="/settings" element={<Settings />} />
      <Route path="/upload" element={<Upload />} />
      <Route path="/create" element={<Camera />} />
      <Route path="/creator-studio" element={<CreatorStudio />} />
      <Route path="/achievements" element={<Achievements />} />
      <Route path="/wallet" element={<Wallet />} />
      <Route path="/user/:username" element={<UserProfile />} />
      <Route path="/tag/:tag" element={<HashtagFeed />} />

      <Route path="*" element={<PageNotFound />} />
    </Routes>
  );
};

function App() {
  return (
    <Router>
      <AuthProvider>
        <ToastProvider>
          <QueryClientProvider client={queryClientInstance}>
            <Routes>
              <Route path="/login" element={<Login />} />
              <Route path="/*" element={<AuthenticatedApp />} />
            </Routes>
            <Toaster />
          </QueryClientProvider>
        </ToastProvider>
      </AuthProvider>
    </Router>
  );
}

export default App;
