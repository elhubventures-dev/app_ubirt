import React, { useEffect, useRef } from "react";
import { dataProvider } from "@/api/dataProvider";
import { isSupabaseConfigured } from "@/lib/supabaseClient";
import { useAuth } from "@/lib/AuthContext";
import { playNotificationSound } from "@/lib/notificationSound";
import { hapticMessageSent } from "@/lib/haptics";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

export function useConversations(options = {}) {
  const includeArchived = Boolean(options.includeArchived);
  return useQuery({
    queryKey: ["conversations", includeArchived ? "archived" : "inbox"],
    queryFn: () => dataProvider.getConversations({ includeArchived }),
  });
}

export function useConversation(chatId) {
  return useQuery({
    queryKey: ["conversation", chatId],
    queryFn: () => dataProvider.getConversation(chatId),
    enabled: Boolean(chatId),
    refetchInterval: isSupabaseConfigured() ? 30_000 : false,
  });
}

export function useChatMessages(chatId) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const reactionDebounceRef = useRef(null);
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
    let unsubscribeRead = () => {};
    let unsubscribeReactions = () => {};

    try {
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

    if (dataProvider.subscribeToReadReceipts) {
      try {
        unsubscribeRead = dataProvider.subscribeToReadReceipts(chatId, () => {
          queryClient.invalidateQueries({ queryKey: ["conversation", chatId] });
        });
      } catch (e) {
        console.warn("Failed to subscribe to read receipts:", e);
      }
    }

    if (dataProvider.subscribeToMessageReactions) {
      try {
        unsubscribeReactions = dataProvider.subscribeToMessageReactions(chatId, () => {
          if (reactionDebounceRef.current) clearTimeout(reactionDebounceRef.current);
          reactionDebounceRef.current = setTimeout(() => {
            queryClient.invalidateQueries({ queryKey: ["messages", chatId] });
          }, 300);
        });
      } catch (e) {
        console.warn("Failed to subscribe to reactions:", e);
      }
    }

    return () => {
      unsubscribeMessages();
      unsubscribePresence();
      unsubscribeRead();
      unsubscribeReactions();
      if (reactionDebounceRef.current) clearTimeout(reactionDebounceRef.current);
    };
  }, [chatId, queryClient, user?.id]);

  const sendMutation = useMutation({
    mutationFn: ({ text, attachment, replyToId, sharedPostId }) =>
      dataProvider.sendMessage(chatId, text, attachment, { replyToId, sharedPostId }),
    onSuccess: (newMsg) => {
      hapticMessageSent();
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

  const reactionMutation = useMutation({
    mutationFn: ({ messageId, emoji }) => dataProvider.toggleMessageReaction(messageId, emoji),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["messages", chatId] });
    },
  });

  const searchMessages = async (query) => {
    if (!dataProvider.searchMessages) return [];
    return dataProvider.searchMessages(chatId, query);
  };

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
    toggleReaction: reactionMutation.mutateAsync,
    searchMessages,
    updateTyping: (isTyping) => dataProvider.updateTypingStatus(chatId, isTyping),
  };
}
