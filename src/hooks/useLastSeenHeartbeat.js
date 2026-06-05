import { useEffect } from "react";
import { dataProvider } from "@/api/dataProvider";
import { useAuth } from "@/lib/AuthContext";
import { isSupabaseConfigured } from "@/lib/supabaseClient";

const HEARTBEAT_MS = 60_000;

export function useLastSeenHeartbeat() {
  const { user } = useAuth();

  useEffect(() => {
    if (!user || !isSupabaseConfigured() || !dataProvider.updateLastSeen) return undefined;

    const ping = () => {
      dataProvider.updateLastSeen().catch(() => {});
    };

    ping();
    const intervalId = window.setInterval(ping, HEARTBEAT_MS);

    const onVisibility = () => {
      ping();
    };
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("pagehide", ping);
    window.addEventListener("focus", ping);

    return () => {
      window.clearInterval(intervalId);
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("pagehide", ping);
      window.removeEventListener("focus", ping);
      ping();
    };
  }, [user]);
}
