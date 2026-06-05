import { useEffect } from "react";
import { dataProvider } from "@/api/dataProvider";
import { getSupabase, isLiveMode, isSupabaseConfigured } from "@/lib/supabaseClient";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/lib/AuthContext";
import { useToast } from "@/components/ui/use-toast";

export function useNotifications() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { toast } = useToast();

  const query = useQuery({
    queryKey: ["notifications"],
    queryFn: dataProvider.getNotifications,
  });

  const markReadMutation = useMutation({
    mutationFn: (id) => dataProvider.markNotificationRead(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["notifications"] }),
  });

  const markAllReadMutation = useMutation({
    mutationFn: () => dataProvider.markAllNotificationsRead(),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["notifications"] }),
  });

  useEffect(() => {
    if (!user || !isLiveMode() || !isSupabaseConfigured()) return undefined;

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
          queryClient.invalidateQueries({ queryKey: ["notifications"] });
          toast({
            title: "New Notification",
            description: payload.new.text || "Someone interacted with you.",
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, queryClient, toast]);

  return {
    ...query,
    markRead: markReadMutation.mutateAsync,
    markAllRead: markAllReadMutation.mutateAsync,
    isMarkingRead: markReadMutation.isPending || markAllReadMutation.isPending,
  };
}
