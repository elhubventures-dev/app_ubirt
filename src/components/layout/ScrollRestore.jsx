import { useLocation } from "react-router-dom";
import { useScrollRestore } from "@/hooks/useScrollRestore";

/** Drop into standalone pages (outside MainLayout) to restore window scroll. */
export default function ScrollRestore({ routeKey }) {
  const location = useLocation();
  useScrollRestore(routeKey ?? location.pathname);
  return null;
}
