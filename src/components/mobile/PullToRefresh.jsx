import { useRef } from "react";
import { usePullToRefresh, PullToRefreshIndicator } from "@/hooks/usePullToRefresh";

/** Pull-to-refresh wrapper for scrollable page content. */
export default function PullToRefresh({ onRefresh, children, className = "" }) {
  const scrollRef = useRef(null);
  const { offset, refreshing } = usePullToRefresh(scrollRef, onRefresh);

  return (
    <div className={`relative ${className}`}>
      <PullToRefreshIndicator offset={offset} refreshing={refreshing} />
      <div ref={scrollRef} className="h-full overflow-y-auto">
        {children}
      </div>
    </div>
  );
}
