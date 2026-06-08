import React, { useEffect } from "react";
import { dataProvider } from "@/api/dataProvider";
import { isSupabaseConfigured } from "@/lib/supabaseClient";
import { useAuth } from "@/lib/AuthContext";
import { playNotificationSound } from "@/lib/notificationSound";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

export function useConversations() {
  return useQuery({
    queryKey: ["conversations"],
    queryFn: dataProvider.getConversations,
  });
}

export function useConversation(chatId) {
  return useQuery({
    queryKey: ["conversation", chatId],
    queryFn: () => dataProvider.getConversation(chatId),
    enabled: Boolean(chatId),
    refetchInterval: isSupabaseConfigured() ? 10_000 : false,
  });
}

export function useChatMessages(chatId) {
  const { user } = useAuth();
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
    refetchInterval: isSupabaseConfigured() ? false : 1200,
  });

  const [peerPresent, setPeerPresent] = React.useState(false);
  const [realtimeTyping, setRealtimeTyping] = React.useState(false);
  const [typingUsers, setTypingUsers] = React.useState([]);
  const [onlineUsers, setOnlineUsers] = React.useState([]);

  useEffect(() => {
    if (!chatId || !dataProvider.markConversationRead) return undefined;

    dataProvider
      .markConversationRead(chatId)
      .then(() => queryClient.invalidateQueries({ queryKey: ["conversations"] }))
      .catch(() => {});

    return undefined;
  }, [chatId, queryClient]);

  useEffect(() => {
    if (!chatId) return;
    
    let unsubscribeMessages = () => {};
    let unsubscribePresence = () => {};
    let unsubscribeReadReceipts = () => {};

    try {
      // Subscribe to messages
      unsubscribeMessages = dataProvider.subscribeToMessages(chatId, {
        onInsert: (newMsg) => {
          queryClient.setQueryData(["messages", chatId], (old) => {
            if (!old) return [newMsg];
            if (old.some((m) => m.id === newMsg.id)) return old;
            return [...old, newMsg];
          });
          if (newMsg.role === "other") {
            playNotificationSound("message");
          }
          queryClient.invalidateQueries({ queryKey: ["conversations"] });
        },
        onDelete: (messageId) => {
          queryClient.setQueryData(["messages", chatId], (old) =>
            (old ?? []).filter((m) => m.id !== messageId)
          );
          queryClient.invalidateQueries({ queryKey: ["conversations"] });
        },
      }) || (() => {});
    } catch (e) {
      console.warn("Failed to subscribe to messages:", e);
    }

    try {
      // Subscribe to presence
      unsubscribePresence = dataProvider.subscribeToPresence(chatId, (state) => {
        let present = false;
        let peerTyping = false;
        const online = [];
        const typers = [];
        for (const key in state) {
          state[key].forEach((presence) => {
            if (presence.user_id === user?.id) return;
            present = true;
            online.push({
              id: presence.user_id,
              name: presence.profile?.display_name ?? presence.profile?.username ?? "Member",
            });
            if (presence.typing) {
              peerTyping = true;
              typers.push(
                presence.profile?.display_name ?? presence.profile?.username ?? "Someone"
              );
            }
          });
        }
        setPeerPresent(present);
        setRealtimeTyping(peerTyping);
        setOnlineUsers(online);
        setTypingUsers(typers);
      }) || (() => {});
    } catch (e) {
      console.warn("Failed to subscribe to presence:", e);
    }

    try {
      if (dataProvider.subscribeToReadReceipts) {
        unsubscribeReadReceipts = dataProvider.subscribeToReadReceipts(chatId, () => {
          queryClient.invalidateQueries({ queryKey: ["conversation", chatId] });
        }) || (() => {});
      }
    } catch (e) {
      console.warn("Failed to subscribe to read receipts:", e);
    }

    return () => {
      unsubscribeMessages();
      unsubscribePresence();
      unsubscribeReadReceipts();
    };
  }, [chatId, queryClient, user?.id]);

  const sendMutation = useMutation({
    mutationFn: ({ text, attachment }) => dataProvider.sendMessage(chatId, text, attachment),
    onSuccess: (newMsg) => {
      queryClient.setQueryData(["messages", chatId], (old) => {
        if (!old) return [newMsg];
        if (old.some((m) => m.id === newMsg.id)) return old;
        return [...old, newMsg];
      });
      queryClient.invalidateQueries({ queryKey: ["conversations"] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: ({ messageId, scope }) => dataProvider.deleteMessage(messageId, scope),
    onSuccess: (_result, { messageId }) => {
      queryClient.setQueryData(["messages", chatId], (old) =>
        (old ?? []).filter((m) => m.id !== messageId)
      );
      queryClient.invalidateQueries({ queryKey: ["conversations"] });
    },
  });

  return {
    ...messagesQuery,
    isTyping: isSupabaseConfigured() ? realtimeTyping : (typingQuery.data ?? false),
    typingUsers,
    peerPresent,
    onlineUsers,
    sendMessage: sendMutation.mutateAsync,
    isSending: sendMutation.isPending,
    deleteMessage: deleteMutation.mutateAsync,
    isDeleting: deleteMutation.isPending,
    updateTyping: (isTyping) => dataProvider.updateTypingStatus(chatId, isTyping),
  };
}
