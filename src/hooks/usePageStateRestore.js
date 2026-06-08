import { useEffect, useRef, useState } from "react";
import { saveNavState, loadNavState } from "@/lib/navigationRestore";

/**
 * Restore/save arbitrary page UI state (tabs, search term, etc.) across navigation.
 */
export function usePageStateRestore(storageKey, initialState) {
  const [state, setState] = useState(() => loadNavState(storageKey) ?? initialState);
  const hydratedRef = useRef(false);

  useEffect(() => {
    if (!hydratedRef.current) {
      hydratedRef.current = true;
      return undefined;
    }
    saveNavState(storageKey, state);
    return () => saveNavState(storageKey, state);
  }, [storageKey, state]);

  return [state, setState];
}
