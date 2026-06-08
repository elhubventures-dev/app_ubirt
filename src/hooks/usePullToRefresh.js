import { useEffect, useRef, useState, useCallback } from "react";
import { hapticLight } from "@/lib/haptics";

const THRESHOLD = 72;

/** Attach pull-to-refresh to a scrollable element ref. */
export function usePullToRefresh(scrollRef, onRefresh, disabled = false) {
  const startY = useRef(0);
  const pulling = useRef(false);
  const offsetRef = useRef(0);
  const refreshingRef = useRef(false);
  const hapticFired = useRef(false);
  const [offset, setOffset] = useState(0);
  const [refreshing, setRefreshing] = useState(false);

  const setOffsetSafe = (value) => {
    offsetRef.current = value;
    setOffset(value);
  };

  const finish = useCallback(async () => {
    if (refreshingRef.current) return;
    refreshingRef.current = true;
    setRefreshing(true);
    setOffsetSafe(THRESHOLD);
    try {
      await onRefresh?.();
    } finally {
      refreshingRef.current = false;
      setRefreshing(false);
      setOffsetSafe(0);
    }
  }, [onRefresh]);

  useEffect(() => {
    const el = scrollRef?.current;
    if (!el || disabled) return;

    const onTouchStart = (e) => {
      if (refreshingRef.current || el.scrollTop > 0) return;
      startY.current = e.touches[0].clientY;
      pulling.current = true;
      hapticFired.current = false;
    };

    const onTouchMove = (e) => {
      if (!pulling.current || refreshingRef.current) return;
      const delta = e.touches[0].clientY - startY.current;
      if (delta <= 0 || el.scrollTop > 0) {
        setOffsetSafe(0);
        return;
      }
      const next = Math.min(delta * 0.45, THRESHOLD + 24);
      setOffsetSafe(next);
      if (next >= THRESHOLD && !hapticFired.current) {
        hapticFired.current = true;
        hapticLight();
      }
    };

    const onTouchEnd = async () => {
      if (!pulling.current) return;
      pulling.current = false;
      if (offsetRef.current >= THRESHOLD) {
        await finish();
      } else {
        setOffsetSafe(0);
      }
    };

    el.addEventListener("touchstart", onTouchStart, { passive: true });
    el.addEventListener("touchmove", onTouchMove, { passive: true });
    el.addEventListener("touchend", onTouchEnd);
    el.addEventListener("touchcancel", onTouchEnd);

    return () => {
      el.removeEventListener("touchstart", onTouchStart);
      el.removeEventListener("touchmove", onTouchMove);
      el.removeEventListener("touchend", onTouchEnd);
      el.removeEventListener("touchcancel", onTouchEnd);
    };
  }, [scrollRef, disabled, finish]);

  return { offset, refreshing };
}
