import { Link, useLocation } from "react-router-dom";
import { getButtonClasses } from "@/components/ui/PrimaryButton";

const routeTitles = {
  "/": "Home",
  "/feed": "Video Feed",
  "/messages": "Messages",
  "/profile": "Profile",
  "/notifications": "Notifications",
  "/search": "Search",
};

export default function AppHeader() {
  const location = useLocation();
  const title = routeTitles[location.pathname] ?? "UBIRT";

  return (
    <header className="sticky top-0 z-40 bg-[#101822]/95 backdrop-blur border-b border-white/10 pt-[env(safe-area-inset-top)]">
      <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between">
        <div>
          <p className="text-slate-400 text-xs tracking-widest uppercase">UBIRT.AI</p>
          <h1 className="text-white text-lg font-semibold">{title}</h1>
        </div>
        <div className="flex items-center gap-2">
          <Link
            to="/upload"
            aria-label="Open upload draft page"
            className={getButtonClasses("secondary", "sm")}
          >
            Upload
          </Link>
          <Link
            to="/creator-studio"
            aria-label="Open creator studio"
            className={getButtonClasses("primary", "sm")}
          >
            Studio
          </Link>
        </div>
      </div>
    </header>
  );
}
