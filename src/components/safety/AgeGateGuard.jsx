import { useEffect, useState } from "react";
import { dataProvider } from "@/api/dataProvider";
import { useAuth } from "@/lib/AuthContext";
import AgeGateModal from "@/components/safety/AgeGateModal";

export default function AgeGateGuard({ children }) {
  const { user, isLiveAuth } = useAuth();
  const [needsGate, setNeedsGate] = useState(false);
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    if (!user) {
      setNeedsGate(false);
      setChecked(true);
      return;
    }

    let active = true;
    (async () => {
      try {
        if (isLiveAuth && dataProvider.getAgeConfirmedAt) {
          const confirmedAt = await dataProvider.getAgeConfirmedAt();
          if (active) setNeedsGate(!confirmedAt);
        } else {
          setNeedsGate(localStorage.getItem("ubirt.pref.ageConfirmed") !== "true");
        }
      } catch {
        if (active) setNeedsGate(false);
      } finally {
        if (active) setChecked(true);
      }
    })();

    return () => {
      active = false;
    };
  }, [user, isLiveAuth]);

  if (!user || !checked) return children;
  if (needsGate) {
    return <AgeGateModal onConfirmed={() => setNeedsGate(false)} />;
  }
  return children;
}
