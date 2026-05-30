import React, { useEffect } from "react";
import { dataProvider } from "@/api/dataProvider";
import { getSupabase, isLiveMode, isSupabaseConfigured } from "@/lib/supabaseClient";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

export function useConversations() {
  return useQuery({
    queryKey: ["conversations"],
    queryFn: dataProvider.getConversations,
  });
}

export function useChatMessages(chatId) {
  const queryClient = useQueryClient();
  const messagesQuery = useQuery({
    queryKey: ["messages", chatId],
    queryFn: () => dataProvider.getMessages(chatId),
    enabled: Boolean(chatId),
  });

  const typingQuery = useQuery({
    queryKey: ["chat-typing", chatId],
    queryFn: () => dataProvider.getChatTyping(chatId),
    enabled: Boolean(chatId),
    refetchInterval: isLiveMode() ? false : 1200,
  });

  const [onlineUsers, setOnlineUsers] = React.useState([]);
  const [realtimeTyping, setRealtimeTyping] = React.useState(false);

  useEffect(() => {
    if (!chatId) return;
    
    // Subscribe to messages
    const unsubscribeMessages = dataProvider.subscribeToMessages(chatId, (newMsg) => {
      queryClient.setQueryData(["messages", chatId], (old) => {
        if (!old) return [newMsg];
        // prevent duplicate
        if (old.some(m => m.id === newMsg.id)) return old;
        return [...old, newMsg];
      });
      queryClient.invalidateQueries({ queryKey: ["conversations"] });
    });

    // Subscribe to presence
    const unsubscribePresence = dataProvider.subscribeToPresence(chatId, (state) => {
      const users = [];
      let someoneTyping = false;
      for (const key in state) {
        state[key].forEach(presence => {
          if (presence.profile) {
            users.push(presence.profile);
          }
          if (presence.typing) {
            someoneTyping = true;
          }
        });
      }
      setOnlineUsers(users);
      setRealtimeTyping(someoneTyping);
    });

    return () => {
      unsubscribeMessages();
      unsubscribePresence();
    };
  }, [chatId, queryClient]);

  const sendMutation = useMutation({
    mutationFn: ({ text, attachment }) => dataProvider.sendMessage(chatId, text, attachment),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["messages", chatId] });
      queryClient.invalidateQueries({ queryKey: ["conversations"] });
    },
  });

  return {
    ...messagesQuery,
    isTyping: isLiveMode() ? realtimeTyping : (typingQuery.data ?? false),
    onlineUsers,
    sendMessage: sendMutation.mutateAsync,
    isSending: sendMutation.isPending,
    updateTyping: (isTyping) => dataProvider.updateTypingStatus(chatId, isTyping),
  };
}
