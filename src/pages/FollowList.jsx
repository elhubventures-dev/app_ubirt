import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { dataProvider } from "@/api/dataProvider";
import { useAuth } from "@/lib/AuthContext";
import { useToast } from "@/components/ui/use-toast";
import PageHeader from "@/components/layout/PageHeader";

export default function FollowList() {
  const { username } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const { user: currentUser } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const isFollowers = location.pathname.endsWith("/followers");
  const listType = isFollowers ? "followers" : "following";

  const { data: profile } = useQuery({
    queryKey: ["public-profile", username],
    queryFn: () => dataProvider.getPublicProfile(username),
    enabled: Boolean(username),
  });

  const { data: users = [], isLoading, isError } = useQuery({
    queryKey: [listType, username],
    queryFn: () => (isFollowers ? dataProvider.getFollowers(username) : dataProvider.getFollowing(username)),
    enabled: Boolean(username),
  });

  const followMutation = useMutation({
    mutationFn: (targetUsername) => dataProvider.toggleFollow(targetUsername),
    onSuccess: (_, targetUsername) => {
      queryClient.invalidateQueries({ queryKey: [listType, username] });
      queryClient.invalidateQueries({ queryKey: ["public-profile", username] });
      queryClient.invalidateQueries({ queryKey: ["public-profile", targetUsername] });
      queryClient.invalidateQueries({ queryKey: ["creator-stats"] });
    },
    onError: (error) => {
      toast({ title: "Follow failed", description: error.message, variant: "destructive" });
    },
  });

  const displayName = profile?.name ?? username;
  const title = isFollowers ? "Followers" : "Following";

  return (
    <div className="flex flex-col min-h-[100dvh] bg-[#0a0f16] pb-6">
      <PageHeader
        onBack={() => navigate(-1)}
        center={
          <div className="min-w-0 text-center">
            <h1 className="text-base font-bold text-white truncate">{title}</h1>
            <p className="text-xs text-slate-400 truncate">@{username}</p>
          </div>
        }
        className="sticky top-0 bg-[#0a0f16]/95"
      />

      <div className="flex border-b border-white/5 shrink-0">
        <Link
          to={`/user/${username}/followers`}
          replace
          className={`flex-1 py-3 text-center text-sm font-semibold transition-colors ${
            isFollowers ? "text-white border-b-2 border-[#3b82f6]" : "text-slate-500"
          }`}
        >
          Followers
        </Link>
        <Link
          to={`/user/${username}/following`}
          replace
          className={`flex-1 py-3 text-center text-sm font-semibold transition-colors ${
            !isFollowers ? "text-white border-b-2 border-[#3b82f6]" : "text-slate-500"
          }`}
        >
          Following
        </Link>
      </div>

      <div className="flex-1 px-2 pt-2">
        {isLoading ? (
          <p className="text-center text-slate-400 py-12 text-sm">Loading...</p>
        ) : isError ? (
          <p className="text-center text-slate-400 py-12 text-sm">Could not load {listType}.</p>
        ) : users.length === 0 ? (
          <div className="text-center py-16 px-6">
            <span className="material-symbols-outlined text-[48px] text-slate-600">
              {isFollowers ? "group" : "person_search"}
            </span>
            <p className="text-slate-300 mt-4 font-semibold">
              {isFollowers ? "No followers yet" : "Not following anyone yet"}
            </p>
            <p className="text-slate-500 text-sm mt-1">
              {isFollowers
                ? `${displayName} doesn't have any followers yet.`
                : `${displayName} isn't following anyone yet.`}
            </p>
          </div>
        ) : (
          <ul className="space-y-1">
            {users.map((person) => {
              const isSelf = person.isSelf || person.username?.toLowerCase() === currentUser?.username?.toLowerCase();
              const isPending =
                followMutation.isPending && followMutation.variables === person.username;

              return (
                <li
                  key={person.id}
                  className="flex items-center gap-3 p-3 rounded-2xl hover:bg-white/5 transition-colors"
                >
                  <Link
                    to={`/user/${person.username}`}
                    className="flex items-center gap-3 flex-1 min-w-0"
                  >
                    <div className="w-12 h-12 rounded-full bg-slate-800 overflow-hidden shrink-0">
                      <img
                        src={person.avatar || `https://api.dicebear.com/9.x/notionists/svg?seed=${person.username}`}
                        alt=""
                        className="w-full h-full object-cover"
                      />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold text-white truncate">{person.name}</p>
                      <p className="text-sm text-slate-400 truncate">@{person.username}</p>
                    </div>
                  </Link>

                  {!isSelf && (
                    <button
                      type="button"
                      disabled={isPending}
                      onClick={() => followMutation.mutate(person.username)}
                      className={`shrink-0 px-4 h-9 rounded-full text-xs font-bold transition-colors disabled:opacity-60 ${
                        person.isFollowing
                          ? "bg-white/10 text-white border border-white/20 hover:bg-white/20"
                          : "bg-[#3b82f6] text-white hover:bg-[#2563eb]"
                      }`}
                    >
                      {isPending ? "..." : person.isFollowing ? "Following" : isFollowers ? "Follow back" : "Follow"}
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
        )}

        {profile && users.length > 0 && (
          <p className="text-center text-xs text-slate-500 py-4">
            {formatCount(isFollowers ? profile.followers : profile.following)} total
          </p>
        )}
      </div>
    </div>
  );
}
