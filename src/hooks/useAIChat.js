import { dataProvider } from "@/api/dataProvider";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

export function useAIChat() {
  const queryClient = useQueryClient();
  const messagesQuery = useQuery({
    queryKey: ["ai-chat"],
    queryFn: dataProvider.getAiMessages,
  });
  const metaQuery = useQuery({
    queryKey: ["ai-chat-meta"],
    queryFn: dataProvider.getAiConversationMeta,
  });

  const askMutation = useMutation({
    mutationFn: dataProvider.askAi,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["ai-chat"] }),
  });

  const retryMutation = useMutation({
    mutationFn: dataProvider.retryLastAiResponse,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["ai-chat"] }),
  });
  const renameMutation = useMutation({
    mutationFn: dataProvider.renameAiConversation,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["ai-chat-meta"] }),
  });
  const deleteMutation = useMutation({
    mutationFn: dataProvider.deleteAiMessage,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["ai-chat"] }),
  });
  const clearMutation = useMutation({
    mutationFn: dataProvider.clearAiConversation,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["ai-chat"] }),
  });

  return {
    ...messagesQuery,
    meta: metaQuery.data,
    askAi: askMutation.mutateAsync,
    retryLast: retryMutation.mutateAsync,
    renameConversation: renameMutation.mutateAsync,
    deleteMessage: deleteMutation.mutateAsync,
    clearConversation: clearMutation.mutateAsync,
    isAsking: askMutation.isPending,
    isRetrying: retryMutation.isPending,
    isRenaming: renameMutation.isPending,
    isDeleting: deleteMutation.isPending,
    isClearing: clearMutation.isPending,
  };
}
