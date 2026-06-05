const PREFIX = "ubirt.pref.";

export function getPreference(key, defaultValue = true) {
  const stored = localStorage.getItem(`${PREFIX}${key}`);
  if (stored === null) return defaultValue;
  return stored !== "false";
}

export function setPreference(key, value) {
  localStorage.setItem(`${PREFIX}${key}`, String(value));
}
