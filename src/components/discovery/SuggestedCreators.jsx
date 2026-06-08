import { Link } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { dataProvider } from "@/api/dataProvider";
import { useToast } from "@/components/ui/use-toast";

export default function SuggestedCreators({ title = "Creators to follow", limit = 4, compact = false }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: creators = [], isLoading } = useQuery({
    queryKey: ["suggested-creators", limit],
    queryFn: () => dataProvider.getSuggestedCreators(limit),
  });

  const followMutation = useMutation({
    mutationFn: (username) => dataProvider.toggleFollow(username),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["suggested-creators"] });
      queryClient.invalidateQueries({ queryKey: ["feed"] });
    },
    onError: (err) => toast({ title: "Follow failed", description: err.message, variant: "destructive" }),
  });

  if (isLoading || !creators.length) return null;

  return (
    <section className={compact ? "" : "mt-2"}>
      {!compact ? (
        <h2 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-3 px-1">{title}</h2>
      ) : null}
      <div className={`flex gap-3 overflow-x-auto hide-scrollbar ${compact ? "pb-2" : "pb-4 -mx-1 px-1"}`}>
        {creators.map((creator) => (
          <div
            key={creator.id}
            className={`shrink-0 ${compact ? "w-36" : "w-40"} rounded-2xl bg-white/5 border border-white/10 p-3 flex flex-col items-center text-center`}
          >
            <Link to={`/user/${creator.username}`} className="w-14 h-14 rounded-full bg-slate-800 overflow-hidden mb-2">
              <img
                src={creator.avatar || `https://api.dicebear.com/9.x/notionists/svg?seed=${creator.username}`}
                alt=""
                className="w-full h-full object-cover"
              />
            </Link>
            <Link to={`/user/${creator.username}`} className="text-sm font-semibold text-white truncate w-full hover:underline">
              {creator.name}
            </Link>
            <p className="text-[10px] text-slate-500 truncate w-full">@{creator.username}</p>
            {creator.followers != null ? (
              <p className="text-[10px] text-slate-400 mt-0.5">{creator.followers.toLocaleString()} followers</p>
            ) : null}
            <button
              type="button"
              onClick={() => followMutation.mutate(creator.username)}
              disabled={followMutation.isPending}
              className="mt-2 w-full py-1.5 rounded-full bg-[#3b82f6] text-white text-xs font-bold hover:bg-[#2563eb] disabled:opacity-50"
            >
              Follow
            </button>
          </div>
        ))}
      </div>
    </section>
  );
}
