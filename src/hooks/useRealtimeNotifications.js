import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/lib/AuthContext";
import { getSupabase, isSupabaseConfigured } from "@/lib/supabaseClient";
import { useToast } from "@/components/ui/use-toast";
import { playNotificationSound } from "@/lib/notificationSound";

export function useRealtimeNotifications() {
  const location = useLocation();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  useEffect(() => {
    if (!user || !isSupabaseConfigured()) return undefined;

    const supabase = getSupabase();
    const channel = supabase
      .channel(`user-notifications:${user.id}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "notifications",
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          const type = payload.new?.type;
          const conversationId = payload.new?.conversation_id;
          const inThisChat =
            type === "message" &&
            conversationId &&
            (location.pathname === `/chat/${conversationId}` ||
              location.pathname === `/group/${conversationId}`);

          queryClient.invalidateQueries({ queryKey: ["notifications"] });
          if (type === "message") {
            queryClient.invalidateQueries({ queryKey: ["conversations"] });
          }

          if (inThisChat) return;

          playNotificationSound(type === "message" ? "message" : "default");
          toast({
            title: type === "message" ? "New message" : "New notification",
            description: payload.new.text || "Someone interacted with you.",
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, queryClient, toast, location.pathname]);
}
