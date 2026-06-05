import { Link, Outlet, useLocation } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import AppHeader from "@/components/layout/AppHeader";
import BottomNav from "@/components/layout/BottomNav";

export default function MainLayout() {
  const location = useLocation();
  const isFeed = location.pathname === "/feed";

  return (
    <div className="min-h-screen bg-[#101822] text-white overflow-hidden relative">
      <div className="absolute inset-0 pointer-events-none bg-gradient-to-tr from-[#0a111a] via-[#101822] to-[#152336] z-0" />
      <div className="absolute top-0 left-0 right-0 h-64 pointer-events-none bg-gradient-to-b from-[#0d5bba]/10 to-transparent z-0" />

      <div className="relative z-10 h-full flex flex-col">
        {!isFeed && <AppHeader />}

        <main className={`flex-1 relative ${isFeed ? "h-[100dvh] w-full" : "max-w-4xl mx-auto w-full px-4 py-4 pb-28"}`}>
          <AnimatePresence mode="wait">
            <motion.div
              key={location.pathname}
              initial={{ opacity: 0, y: 10, filter: "blur(4px)" }}
              animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
              exit={{ opacity: 0, y: -10, filter: "blur(4px)" }}
              transition={{ duration: 0.3, ease: "easeInOut" }}
              className="h-full w-full"
            >
              <Outlet />
            </motion.div>
          </AnimatePresence>
        </main>

        <BottomNav />

        {!isFeed && (
          <Link
            to="/create"
            aria-label="Create photo post"
            className="fixed bottom-[calc(5.5rem+env(safe-area-inset-bottom))] right-5 z-[60] w-14 h-14 rounded-full bg-[#3b82f6] text-white shadow-[0_8px_24px_rgba(59,130,246,0.5)] flex items-center justify-center hover:bg-[#2563eb] active:scale-95 transition-all border border-white/10"
          >
            <span className="material-symbols-outlined text-[28px]">photo_camera</span>
          </Link>
        )}
      </div>
    </div>
  );
}
