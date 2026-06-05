import { dataProvider } from "@/api/dataProvider";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/lib/AuthContext";

function patchFeedPosts(queryClient, feedType, postId, patch) {
  queryClient.setQueryData(["feed", feedType], (old) => {
    if (!Array.isArray(old)) return old;
    return old.map((post) => (post.id === postId ? { ...post, ...patch } : post));
  });
}

export function useFeed(feedType = "foryou") {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const feedQuery = useQuery({
    queryKey: ["feed", feedType],
    queryFn: () => dataProvider.getFeed(feedType),
  });

  const likeMutation = useMutation({
    mutationFn: dataProvider.toggleLike,
    onMutate: async (postId) => {
      await queryClient.cancelQueries({ queryKey: ["feed", feedType] });
      const previous = queryClient.getQueryData(["feed", feedType]);
      const current = Array.isArray(previous) ? previous.find((p) => p.id === postId) : null;
      if (current) {
        patchFeedPosts(queryClient, feedType, postId, {
          liked: !current.liked,
          likes: Math.max(0, (current.likes ?? 0) + (current.liked ? -1 : 1)),
        });
      }
      return { previous };
    },
    onError: (_err, _postId, context) => {
      if (context?.previous) {
        queryClient.setQueryData(["feed", feedType], context.previous);
      }
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: ["feed"] }),
  });

  const bookmarkMutation = useMutation({
    mutationFn: dataProvider.toggleBookmark,
    onMutate: async (postId) => {
      await queryClient.cancelQueries({ queryKey: ["feed", feedType] });
      const previous = queryClient.getQueryData(["feed", feedType]);
      const current = Array.isArray(previous) ? previous.find((p) => p.id === postId) : null;
      if (current) {
        patchFeedPosts(queryClient, feedType, postId, {
          bookmarked: !current.bookmarked,
        });
      }
      return { previous };
    },
    onError: (_err, _postId, context) => {
      if (context?.previous) {
        queryClient.setQueryData(["feed", feedType], context.previous);
      }
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: ["feed"] }),
  });

  const commentMutation = useMutation({
    mutationFn: async ({ postId, text }) => {
      if (dataProvider.analyzeCommentToxicity) {
        const isToxic = await dataProvider.analyzeCommentToxicity(text);
        if (isToxic) {
          throw new Error("This comment was flagged for toxicity and has been held for review.");
        }
      }
      return dataProvider.addComment(postId, text);
    },
    onMutate: async ({ postId, text }) => {
      await queryClient.cancelQueries({ queryKey: ["feed", feedType] });
      await queryClient.cancelQueries({ queryKey: ["feed-comments", postId] });

      const previous = queryClient.getQueryData(["feed", feedType]);
      const previousComments = queryClient.getQueryData(["feed-comments", postId]);
      const current = Array.isArray(previous) ? previous.find((p) => p.id === postId) : null;

      if (current) {
        patchFeedPosts(queryClient, feedType, postId, {
          comments: (current.comments ?? 0) + 1,
        });
      }

      queryClient.setQueryData(["feed-comments", postId], (old = []) => [
        ...(Array.isArray(old) ? old : []),
        {
          id: `pending-${Date.now()}`,
          author: user?.name ?? "You",
          text,
          isMine: true,
        },
      ]);

      return { previous, previousComments, postId };
    },
    onError: (_err, vars, context) => {
      if (context?.previous) {
        queryClient.setQueryData(["feed", feedType], context.previous);
      }
      if (context?.previousComments !== undefined) {
        queryClient.setQueryData(["feed-comments", vars.postId], context.previousComments);
      }
    },
    onSuccess: (data, vars) => {
      queryClient.setQueryData(["feed-comments", vars.postId], (old = []) => {
        const list = Array.isArray(old) ? old : [];
        const withoutPending = list.filter((c) => !String(c.id).startsWith("pending-"));
        if (data && !withoutPending.some((c) => c.id === data.id)) {
          return [...withoutPending, data];
        }
        return withoutPending;
      });
      queryClient.invalidateQueries({ queryKey: ["feed"] });
      queryClient.invalidateQueries({ queryKey: ["feed-comments", vars.postId] });
    },
  });

  const deleteCommentMutation = useMutation({
    mutationFn: ({ postId, commentId }) => dataProvider.deleteComment(postId, commentId),
    onMutate: async ({ postId, commentId }) => {
      await queryClient.cancelQueries({ queryKey: ["feed", feedType] });
      await queryClient.cancelQueries({ queryKey: ["feed-comments", postId] });

      const previous = queryClient.getQueryData(["feed", feedType]);
      const previousComments = queryClient.getQueryData(["feed-comments", postId]);
      const current = Array.isArray(previous) ? previous.find((p) => p.id === postId) : null;

      if (current) {
        patchFeedPosts(queryClient, feedType, postId, {
          comments: Math.max(0, (current.comments ?? 0) - 1),
        });
      }

      queryClient.setQueryData(["feed-comments", postId], (old = []) =>
        (Array.isArray(old) ? old : []).filter((comment) => comment.id !== commentId)
      );

      return { previous, previousComments, postId };
    },
    onError: (_err, vars, context) => {
      if (context?.previous) {
        queryClient.setQueryData(["feed", feedType], context.previous);
      }
      if (context?.previousComments !== undefined) {
        queryClient.setQueryData(["feed-comments", vars.postId], context.previousComments);
      }
    },
    onSettled: (_result, _err, vars) => {
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
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["wallet-balance"] });
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
    },
  });

  return {
    ...feedQuery,
    toggleLike: likeMutation.mutateAsync,
    toggleBookmark: bookmarkMutation.mutateAsync,
    addComment: commentMutation.mutateAsync,
    deleteComment: deleteCommentMutation.mutateAsync,
    deletePost: deleteMutation.mutateAsync,
    sendGift: giftMutation.mutateAsync,
    isMutating: likeMutation.isPending || bookmarkMutation.isPending || deleteMutation.isPending,
    isCommenting: commentMutation.isPending,
    isDeletingComment: deleteCommentMutation.isPending,
    isGifting: giftMutation.isPending,
  };
}

export function useFeedComments(postId) {
  return useQuery({
    queryKey: ["feed-comments", postId],
    queryFn: () => dataProvider.getComments(postId),
    enabled: Boolean(postId),
    staleTime: 10_000,
  });
}
