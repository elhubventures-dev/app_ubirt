import { dataProvider } from "@/api/dataProvider";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

export function useFeed(feedType = "foryou") {
  const queryClient = useQueryClient();
  const feedQuery = useQuery({
    queryKey: ["feed", feedType],
    queryFn: () => dataProvider.getFeed(feedType),
  });

  const likeMutation = useMutation({
    mutationFn: dataProvider.toggleLike,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["feed"] }),
  });

  const bookmarkMutation = useMutation({
    mutationFn: dataProvider.toggleBookmark,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["feed"] }),
  });

  const commentMutation = useMutation({
    mutationFn: async ({ postId, text }) => {
      const isToxic = await dataProvider.analyzeCommentToxicity(text);
      if (isToxic) {
        throw new Error("This comment was flagged for toxicity and has been held for review.");
      }
      return dataProvider.addComment(postId, text);
    },
    onSuccess: (_data, vars) => {
      queryClient.invalidateQueries({ queryKey: ["feed"] });
      queryClient.invalidateQueries({ queryKey: ["feed-comments", vars.postId] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: dataProvider.deletePost,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["feed"] });
    },
  });

  const giftMutation = useMutation({
    mutationFn: ({ postId, amount }) => dataProvider.sendGift(postId, amount),
  });

  return {
    ...feedQuery,
    toggleLike: likeMutation.mutateAsync,
    toggleBookmark: bookmarkMutation.mutateAsync,
    addComment: commentMutation.mutateAsync,
    deletePost: deleteMutation.mutateAsync,
    sendGift: giftMutation.mutateAsync,
    isMutating: likeMutation.isPending || bookmarkMutation.isPending || deleteMutation.isPending,
    isCommenting: commentMutation.isPending,
    isGifting: giftMutation.isPending,
  };
}

export function useFeedComments(postId) {
  return useQuery({
    queryKey: ["feed-comments", postId],
    queryFn: () => dataProvider.getComments(postId),
    enabled: Boolean(postId),
  });
}
