import { Link, useLocation } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { dataProvider } from "@/api/dataProvider";

export function useUnreadNotificationCount() {
  const { data: items = [] } = useQuery({
    queryKey: ["notifications"],
    queryFn: dataProvider.getNotifications,
    staleTime: 30_000,
  });
  return items.filter((item) => !item.read).length;
}

export default function NotificationBell({
  className = "",
  iconClassName = "text-[22px]",
  variant = "default",
}) {
  const location = useLocation();
  const unreadCount = useUnreadNotificationCount();
  const isActive = location.pathname === "/notifications";

  const variantStyles =
    variant === "overlay"
      ? "bg-black/40 backdrop-blur-md text-white hover:bg-black/60 border border-white/10"
      : "hover:bg-white/10 text-slate-300 hover:text-white";

  return (
    <Link
      to="/notifications"
      aria-label={unreadCount ? `${unreadCount} unread notifications` : "Notifications"}
      aria-current={isActive ? "page" : undefined}
      className={`relative flex items-center justify-center w-10 h-10 rounded-full transition-colors shrink-0 ${variantStyles} ${className}`}
    >
      <span
        className={`material-symbols-outlined ${iconClassName} ${isActive ? "text-[#3b82f6]" : ""}`}
        style={{
          fontVariationSettings: unreadCount || isActive ? "'FILL' 1, 'wght' 500" : "'FILL' 0, 'wght' 400",
        }}
      >
        notifications
      </span>
      {unreadCount > 0 ? (
        <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center border-2 border-[#101822] shadow-sm">
          {unreadCount > 99 ? "99+" : unreadCount}
        </span>
      ) : null}
    </Link>
  );
}
