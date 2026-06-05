export function formatCount(value) {
  const num = Number(value);
  if (!Number.isFinite(num) || num < 0) return "0";
  if (num >= 1_000_000) {
    const m = num / 1_000_000;
    return `${m >= 10 ? Math.round(m) : m.toFixed(1).replace(/\.0$/, "")}M`;
  }
  if (num >= 10_000) {
    const k = num / 1_000;
    return `${k >= 100 ? Math.round(k) : k.toFixed(1).replace(/\.0$/, "")}k`;
  }
  return num.toLocaleString();
}
