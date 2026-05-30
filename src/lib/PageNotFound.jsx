import { Link } from "react-router-dom";
import { getButtonClasses } from "@/components/ui/PrimaryButton";

export default function PageNotFound() {
  return (
    <div className="min-h-screen bg-[#101822] text-white flex items-center justify-center px-6">
      <div className="text-center">
        <p className="text-[#0d5bba] text-sm font-semibold tracking-widest uppercase">404</p>
        <h1 className="text-3xl font-bold mt-2">Page not found</h1>
        <p className="text-slate-400 mt-2">The route does not exist in this UBIRT build.</p>
        <Link to="/" className={`inline-block mt-6 ${getButtonClasses("primary", "md")}`}>
          Back to Home
        </Link>
      </div>
    </div>
  );
}
