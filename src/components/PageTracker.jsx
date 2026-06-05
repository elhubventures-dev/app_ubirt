import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import { useAuth } from "@/lib/AuthContext";
import { identifyUser, resetAnalyticsUser, trackPageView } from "@/lib/monitoring";

export default function PageTracker() {
  const location = useLocation();
  const { user } = useAuth();

  useEffect(() => {
    trackPageView(location.pathname + location.search);
  }, [location]);

  useEffect(() => {
    if (user?.id) identifyUser(user);
    else resetAnalyticsUser();
  }, [user]);

  return null;
}
