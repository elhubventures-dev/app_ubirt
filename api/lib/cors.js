const ALLOWED_ORIGINS = new Set([
  "https://www.app.ubirtai.site",
  "https://app.ubirtai.site",
  "http://localhost:5173",
  "https://localhost",
  "http://localhost",
  "capacitor://localhost",
]);

function isAllowedOrigin(origin) {
  if (!origin) return false;
  if (ALLOWED_ORIGINS.has(origin)) return true;
  return origin.startsWith("capacitor://") || origin.startsWith("http://localhost");
}

export function applyCors(req, res) {
  const origin = req.headers.origin;

  if (isAllowedOrigin(origin)) {
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Vary", "Origin");
  } else if (!origin) {
    res.setHeader("Access-Control-Allow-Origin", "*");
  }

  res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  res.setHeader("Access-Control-Max-Age", "86400");
}

export function handleCorsPreflight(req, res) {
  applyCors(req, res);
  if (req.method === "OPTIONS") {
    res.status(204).end();
    return true;
  }
  return false;
}
