import { useMutation, useQueryClient } from "@tanstack/react-query";
import { dataProvider } from "@/api/dataProvider";

export default function PollCard({ postId, poll, compact = false }) {
  const queryClient = useQueryClient();
  const totalVotes = poll?.options?.reduce((s, o) => s + (o.votes ?? 0), 0) ?? 0;
  const userVote = poll?.userVoteId;

  const voteMutation = useMutation({
    mutationFn: (optionId) => dataProvider.votePoll(postId, optionId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["feed"] });
      queryClient.invalidateQueries({ queryKey: ["trending-posts"] });
      queryClient.invalidateQueries({ queryKey: ["feed-post", postId] });
    },
  });

  if (!poll?.options?.length) return null;

  return (
    <div className={`${compact ? "mt-2" : "mt-3"} space-y-2`}>
      {!compact ? <p className="text-xs font-bold text-slate-300 uppercase tracking-wider">Poll</p> : null}
      {poll.options.map((opt) => {
        const pct = totalVotes > 0 ? Math.round((opt.votes / totalVotes) * 100) : 0;
        const isSelected = userVote === opt.id;
        return (
          <button
            key={opt.id}
            type="button"
            disabled={voteMutation.isPending}
            onClick={(e) => {
              e.stopPropagation();
              voteMutation.mutate(opt.id);
            }}
            className={`relative w-full text-left rounded-xl overflow-hidden border transition-colors ${
              isSelected ? "border-[#3b82f6] bg-[#3b82f6]/10" : "border-white/10 bg-white/5 hover:bg-white/10"
            } ${compact ? "py-2 px-3" : "py-2.5 px-3"}`}
          >
            <div
              className="absolute inset-y-0 left-0 bg-[#3b82f6]/20 transition-all"
              style={{ width: `${userVote || totalVotes > 0 ? pct : 0}%` }}
            />
            <div className="relative flex justify-between items-center gap-2">
              <span className={`text-sm ${compact ? "text-slate-200" : "text-white"} font-medium`}>{opt.label}</span>
              {(userVote || totalVotes > 0) && (
                <span className="text-xs text-slate-400 shrink-0">{pct}%</span>
              )}
            </div>
          </button>
        );
      })}
      <p className="text-[10px] text-slate-500">{totalVotes} vote{totalVotes !== 1 ? "s" : ""}</p>
    </div>
  );
}
