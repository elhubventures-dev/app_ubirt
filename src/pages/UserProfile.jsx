import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { dataProvider } from "@/api/dataProvider";
import { useAuth } from "@/lib/AuthContext";
import { useToast } from "@/components/ui/use-toast";

export default function UserProfile() {
  const { username } = useParams();
  const navigate = useNavigate();
  const { user: currentUser } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState("grid");

  const { data: profile, isLoading, isError } = useQuery({
    queryKey: ["public-profile", username],
    queryFn: () => dataProvider.getPublicProfile(username),
    enabled: Boolean(username),
  });

  const followMutation = useMutation({
    mutationFn: () => dataProvider.toggleFollow(username),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["public-profile", username] });
    },
    onError: (error) => {
      toast({ title: "Follow failed", description: error.message, variant: "destructive" });
    },
  });

  const isSelf = currentUser?.username?.toLowerCase() === username?.toLowerCase();
  const bannerUrl = "https://images.unsplash.com/photo-1557683311-eac922347aa1?w=800&h=300&fit=crop&q=80";

  if (isLoading) {
    return (
      <div className="min-h-[100dvh] bg-[#0a0f16] flex items-center justify-center text-slate-400">
        Loading profile...
      </div>
    );
  }

  if (isError || !profile) {
    return (
      <div className="min-h-[100dvh] bg-[#0a0f16] flex flex-col items-center justify-center text-center px-6 gap-4">
        <span className="material-symbols-outlined text-[48px] text-slate-600">person_off</span>
        <p className="text-slate-300 font-semibold">User not found</p>
        <button type="button" onClick={() => navigate(-1)} className="text-[#3b82f6] font-medium">
          Go back
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-[100dvh] bg-[#0a0f16] pb-6 relative overflow-x-hidden">
      <div className="absolute top-0 left-0 right-0 p-4 z-50 flex justify-between items-center bg-gradient-to-b from-black/60 to-transparent">
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="w-10 h-10 rounded-full bg-black/40 backdrop-blur-md flex items-center justify-center text-white"
        >
          <span className="material-symbols-outlined">arrow_back</span>
        </button>
      </div>

      <div className="relative h-48 sm:h-56 rounded-b-[2rem] overflow-hidden shadow-2xl shrink-0">
        <img src={bannerUrl} alt="" className="w-full h-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-t from-[#101822] via-[#101822]/50 to-transparent opacity-90" />
      </div>

      <div className="px-4 relative -mt-16 flex flex-col items-center sm:items-start sm:flex-row sm:gap-6 shrink-0">
        <div className="w-28 h-28 rounded-full border-4 border-[#101822] bg-slate-800 overflow-hidden shadow-xl relative z-10">
          <img
            src={profile.avatar || `https://api.dicebear.com/9.x/notionists/svg?seed=${profile.username}`}
            alt={profile.name}
            className="w-full h-full object-cover"
          />
        </div>

        <div className="mt-3 sm:mt-16 text-center sm:text-left flex-1">
          <h1 className="text-2xl font-bold tracking-tight text-white">{profile.name}</h1>
          <p className="text-sm font-medium text-[#3b82f6]">@{profile.username}</p>

          <div className="mt-4 flex gap-6 justify-center sm:justify-start">
            <div className="text-center">
              <p className="text-white font-bold text-lg">{profile.followers.toLocaleString()}</p>
              <p className="text-slate-400 text-xs font-semibold uppercase">Followers</p>
            </div>
            <div className="text-center">
              <p className="text-white font-bold text-lg">{profile.following.toLocaleString()}</p>
              <p className="text-slate-400 text-xs font-semibold uppercase">Following</p>
            </div>
            <div className="text-center">
              <p className="text-white font-bold text-lg">{profile.totalLikes.toLocaleString()}</p>
              <p className="text-slate-400 text-xs font-semibold uppercase">Likes</p>
            </div>
          </div>

          {!isSelf && (
            <div className="mt-6 flex gap-3 justify-center sm:justify-start">
              <button
                type="button"
                disabled={followMutation.isPending}
                onClick={() => followMutation.mutate()}
                className={`flex-1 max-w-[200px] h-10 rounded-full font-bold text-sm transition-colors disabled:opacity-60 ${
                  profile.isFollowing
                    ? "bg-white/10 text-white hover:bg-white/20 border border-white/20"
                    : "bg-[#3b82f6] text-white hover:bg-[#2563eb]"
                }`}
              >
                {profile.isFollowing ? "Following" : "Follow"}
              </button>
              <Link
                to="/messages"
                className="w-10 h-10 rounded-full border border-white/20 bg-white/5 flex items-center justify-center hover:bg-white/10 transition-colors"
              >
                <span className="material-symbols-outlined text-[20px] text-white">mail</span>
              </Link>
            </div>
          )}
          {isSelf && (
            <div className="mt-6 flex justify-center sm:justify-start">
              <Link
                to="/settings"
                className="px-6 h-10 rounded-full bg-white/10 text-white font-bold text-sm flex items-center hover:bg-white/20"
              >
                Edit profile
              </Link>
            </div>
          )}
        </div>
      </div>

      <div className="mt-8 flex justify-center border-b border-white/5 relative shrink-0">
        {[{ id: "grid", icon: "grid_view" }].map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id)}
            className={`relative px-8 py-3 transition-colors ${activeTab === tab.id ? "text-white" : "text-slate-500"}`}
          >
            {activeTab === tab.id && (
              <motion.div
                layoutId="userProfileTab"
                className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#3b82f6]"
              />
            )}
            <span className="material-symbols-outlined">{tab.icon}</span>
          </button>
        ))}
      </div>

      <div className="mt-2 flex-1 min-h-[300px]">
        <AnimatePresence mode="wait">
          <motion.div
            key="grid"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
          >
            {!profile.posts?.length ? (
              <div className="text-center py-16 px-4">
                <span className="material-symbols-outlined text-[48px] text-slate-600">grid_view</span>
                <p className="text-slate-300 mt-4 font-semibold">No posts yet</p>
              </div>
            ) : (
              <div className="grid grid-cols-3 gap-0.5">
                {profile.posts.map((post) => (
                  <Link
                    key={post.id}
                    to="/feed"
                    className="aspect-[3/4] bg-slate-800 relative group cursor-pointer overflow-hidden"
                  >
                    <img
                      src={
                        post.media_url ||
                        `https://images.unsplash.com/photo-1616469829581-73993eb86b02?w=300&h=400&fit=crop&q=80`
                      }
                      alt=""
                      className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110 opacity-80"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex flex-col justify-end p-2">
                      <div className="flex items-center gap-1 text-slate-300">
                        <span className="material-symbols-outlined text-[14px]">visibility</span>
                        <span className="text-[10px] font-medium">{(post.views ?? 0).toLocaleString()}</span>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}
