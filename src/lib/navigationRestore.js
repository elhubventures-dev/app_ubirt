const PREFIX = "ubirt.nav.";

export function saveNavState(key, state) {
  try {
    sessionStorage.setItem(`${PREFIX}${key}`, JSON.stringify(state));
  } catch {
    // ignore quota / private mode
  }
}

export function loadNavState(key, fallback = null) {
  try {
    const raw = sessionStorage.getItem(`${PREFIX}${key}`);
    if (!raw) return fallback;
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

export function clearNavState(key) {
  try {
    sessionStorage.removeItem(`${PREFIX}${key}`);
  } catch {
    // ignore
  }
}
