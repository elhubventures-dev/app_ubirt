import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { dataProvider } from "@/api/dataProvider";
import { useAuth } from "@/lib/AuthContext";
import { useToast } from "@/components/ui/use-toast";
import ReportSheet from "@/components/safety/ReportSheet";
import VerifiedBadge from "@/components/profile/VerifiedBadge";
import { feedPostPath } from "@/lib/feedLinks";
import { getProfileCoverUrl } from "@/lib/profileDefaults";

export default function UserProfile() {
  const { username } = useParams();
  const navigate = useNavigate();
  const { user: currentUser } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState("grid");
  const [showReport, setShowReport] = useState(false);

  const { data: profile, isLoading, isError } = useQuery({
    queryKey: ["public-profile", username],
    queryFn: () => dataProvider.getPublicProfile(username),
    enabled: Boolean(username),
  });

  const isSelf = currentUser?.username?.toLowerCase() === username?.toLowerCase();

  const { data: isBlocked, refetch: refetchBlocked } = useQuery({
    queryKey: ["is-blocked", profile?.id],
    queryFn: () => dataProvider.isUserBlocked(profile.id),
    enabled: Boolean(profile?.id && !isSelf),
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

  const messageMutation = useMutation({
    mutationFn: (targetUserId) => dataProvider.startConversation(targetUserId),
    onSuccess: (conv) => {
      queryClient.invalidateQueries({ queryKey: ["conversations"] });
      navigate(`/chat/${conv.id}`, { replace: true });
    },
    onError: (error) => {
      toast({ title: "Could not start chat", description: error.message, variant: "destructive" });
    },
  });

  const handleMessage = () => {
    if (!profile?.id || messageMutation.isPending || isBlocked) return;
    messageMutation.mutate(profile.id);
  };

  const bannerUrl = getProfileCoverUrl(profile?.cover);

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
          <h1 className="text-2xl font-bold tracking-tight text-white inline-flex items-center gap-2 justify-center sm:justify-start">
            {profile.name}
            {profile.verified ? <VerifiedBadge className="w-5 h-5" /> : null}
          </h1>
          <p className="text-sm font-medium text-[#3b82f6]">@{profile.username}</p>
          {isSelf && profile.profileViews28d != null ? (
            <p className="text-xs text-slate-500 mt-1">{profile.profileViews28d.toLocaleString()} profile views (28d)</p>
          ) : null}

          {profile.bio ? (
            <p className="mt-2 text-sm text-slate-300 max-w-sm mx-auto sm:mx-0 text-center sm:text-left">{profile.bio}</p>
          ) : null}
          {(profile.location || profile.website) && (
            <div className="mt-2 flex flex-wrap gap-3 justify-center sm:justify-start text-xs text-slate-400">
              {profile.location ? (
                <span className="flex items-center gap-1">
                  <span className="material-symbols-outlined text-[14px]">location_on</span>
                  {profile.location}
                </span>
              ) : null}
              {profile.website ? (
                <a
                  href={profile.website.startsWith("http") ? profile.website : `https://${profile.website}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 text-[#3b82f6] hover:underline"
                >
                  <span className="material-symbols-outlined text-[14px]">link</span>
                  {profile.website.replace(/^https?:\/\//, "")}
                </a>
              ) : null}
            </div>
          )}

          <div className="mt-4 flex gap-6 justify-center sm:justify-start">
            <Link to={`/user/${profile.username}/followers`} className="text-center hover:opacity-80 transition-opacity">
              <p className="text-white font-bold text-lg">{profile.followers.toLocaleString()}</p>
              <p className="text-slate-400 text-xs font-semibold uppercase">Followers</p>
            </Link>
            <Link to={`/user/${profile.username}/following`} className="text-center hover:opacity-80 transition-opacity">
              <p className="text-white font-bold text-lg">{profile.following.toLocaleString()}</p>
              <p className="text-slate-400 text-xs font-semibold uppercase">Following</p>
            </Link>
            <div className="text-center">
              <p className="text-white font-bold text-lg">{profile.totalLikes.toLocaleString()}</p>
              <p className="text-slate-400 text-xs font-semibold uppercase">Likes</p>
            </div>
          </div>

          {!isSelf && (
            <div className="mt-6 flex flex-col gap-3 items-center sm:items-start">
              {isBlocked ? (
                <p className="text-sm text-slate-400">You blocked this user.</p>
              ) : null}
              <div className="flex gap-3 justify-center sm:justify-start w-full">
              <button
                type="button"
                disabled={followMutation.isPending || isBlocked}
                onClick={() => followMutation.mutate()}
                className={`flex-1 max-w-[200px] h-10 rounded-full font-bold text-sm transition-colors disabled:opacity-60 ${
                  profile.isFollowing
                    ? "bg-white/10 text-white hover:bg-white/20 border border-white/20"
                    : "bg-[#3b82f6] text-white hover:bg-[#2563eb]"
                }`}
              >
                {profile.isFollowing ? "Following" : "Follow"}
              </button>
              <button
                type="button"
                disabled={messageMutation.isPending || !profile.id || isBlocked}
                onClick={handleMessage}
                className="w-10 h-10 rounded-full border border-white/20 bg-white/5 flex items-center justify-center hover:bg-white/10 transition-colors disabled:opacity-60"
                aria-label="Send message"
              >
                {messageMutation.isPending ? (
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <span className="material-symbols-outlined text-[20px] text-white">mail</span>
                )}
              </button>
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setShowReport(true)}
                  className="text-xs font-semibold text-slate-400 hover:text-red-400 px-3 py-1.5 rounded-full bg-white/5"
                >
                  Report
                </button>
                <button
                  type="button"
                  onClick={async () => {
                    try {
                      if (isBlocked) {
                        await dataProvider.unblockUser(profile.id);
                        toast({ title: "User unblocked" });
                      } else {
                        await dataProvider.blockUser(profile.id);
                        toast({ title: "User blocked" });
                      }
                      refetchBlocked();
                    } catch (err) {
                      toast({ title: "Action failed", description: err.message, variant: "destructive" });
                    }
                  }}
                  className="text-xs font-semibold text-slate-400 hover:text-white px-3 py-1.5 rounded-full bg-white/5"
                >
                  {isBlocked ? "Unblock" : "Block"}
                </button>
              </div>
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
                    to={feedPostPath(post.id)}
                    className="aspect-[3/4] bg-slate-800 relative group cursor-pointer overflow-hidden"
                  >
                    {post.isPinned ? (
                      <span className="absolute top-2 left-2 z-10 bg-black/60 rounded-full p-1">
                        <span className="material-symbols-outlined text-white text-[14px]">push_pin</span>
                      </span>
                    ) : null}
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

      <AnimatePresence>
        {showReport && profile?.id && (
          <ReportSheet
            targetType="user"
            targetId={profile.id}
            onSubmit={async (payload) => {
              await dataProvider.submitReport(payload);
              toast({ title: "Report submitted", description: "Thanks for helping keep UBIRT safe." });
            }}
            onClose={() => setShowReport(false)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
