import { Link, useLocation } from "react-router-dom";
import { motion } from "framer-motion";

const navItems = [
  { path: "/", icon: "home", label: "Home" },
  { path: "/feed", icon: "play_circle", label: "Reels" },
  { path: "/search", icon: "search", label: "Search" },
  { path: "/messages", icon: "chat_bubble", label: "Messages" },
  { path: "/ai-chat", icon: "smart_toy", label: "AI" },
  { path: "/profile", icon: "person", label: "Profile" },
];

export default function BottomNav() {
  const location = useLocation();

  return (
    <nav className="fixed bottom-[calc(1rem+env(safe-area-inset-bottom))] left-4 right-4 z-50 bg-[#101822]/70 backdrop-blur-xl border border-white/10 rounded-3xl shadow-2xl overflow-hidden">
      <div className="flex items-center justify-around px-2 py-2">
        {navItems.map((item) => {
          const isActive = location.pathname === item.path;
          return (
            <Link
              key={item.path}
              to={item.path}
              aria-label={`Navigate to ${item.label}`}
              aria-current={isActive ? "page" : undefined}
              className="relative flex flex-col items-center gap-0.5 px-3 py-2 rounded-2xl transition-all min-w-0 flex-1"
            >
              {isActive && (
                <motion.div
                  layoutId="nav-pill"
                  className="absolute inset-0 bg-[#0d5bba]/20 border border-[#0d5bba]/30 rounded-2xl"
                  transition={{ type: "spring", damping: 25, stiffness: 350 }}
                />
              )}
              <span
                className="material-symbols-outlined text-[24px] relative z-10 transition-colors duration-300"
                style={{
                  color: isActive ? "#3b82f6" : "#94a3b8", // brighter active color
                  fontVariationSettings: isActive
                    ? "'FILL' 1, 'wght' 500, 'GRAD' 0, 'opsz' 24"
                    : "'FILL' 0, 'wght' 300, 'GRAD' 0, 'opsz' 24",
                  filter: isActive ? "drop-shadow(0 0 4px rgba(59,130,246,0.5))" : "none"
                }}
              >
                {item.icon}
              </span>
              <span
                className={`text-[9px] font-bold relative z-10 transition-colors duration-300 ${isActive ? "text-[#3b82f6]" : "text-slate-500"}`}
              >
                {item.label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}