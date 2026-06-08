import { useEffect, useRef } from "react";
import { saveNavState, loadNavState } from "@/lib/navigationRestore";

/**
 * Persists scroll position for a route key (defaults to pathname).
 * Pass a scroll container ref, or omit to use window scroll.
 */
export function useScrollRestore(routeKey, containerRef) {
  const restoredRef = useRef(false);

  useEffect(() => {
    restoredRef.current = false;
  }, [routeKey]);

  useEffect(() => {
    const getTarget = () => containerRef?.current ?? null;
    const readScroll = () => {
      const el = getTarget();
      return el ? el.scrollTop : window.scrollY;
    };
    const writeScroll = (y) => {
      const el = getTarget();
      if (el) el.scrollTop = y;
      else window.scrollTo({ top: y, behavior: "auto" });
    };

    const storageKey = `scroll.${routeKey}`;
    const saved = loadNavState(storageKey);
    if (saved?.y != null && !restoredRef.current) {
      restoredRef.current = true;
      requestAnimationFrame(() => {
        requestAnimationFrame(() => writeScroll(saved.y));
      });
    }

    let raf = null;
    const persist = () => {
      if (raf) cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        saveNavState(storageKey, { y: readScroll() });
      });
    };

    const el = getTarget();
    const target = el ?? window;
    target.addEventListener("scroll", persist, { passive: true });

    return () => {
      if (raf) cancelAnimationFrame(raf);
      saveNavState(storageKey, { y: readScroll() });
      target.removeEventListener("scroll", persist);
    };
  }, [routeKey, containerRef]);
}
