import { applyCors, handleCorsPreflight } from "./lib/cors.js";
import { authenticateRequest } from "./lib/payment/auth.js";
import { getNeonSql, isNeonConfigured } from "./lib/neon.js";

export default async function handler(req, res) {
  if (handleCorsPreflight(req, res)) return;
  applyCors(req, res);

  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const auth = await authenticateRequest(req);
  if (auth.error) {
    return res.status(auth.error.status).json({ error: auth.error.message });
  }

  let profile = null;
  if (isNeonConfigured()) {
    try {
      const sql = getNeonSql();
      const rows = await sql`
        select * from public.profiles where id = ${auth.user.id} limit 1
      `;
      profile = rows?.[0] ?? null;
    } catch {
      profile = null;
    }
  }

  return res.status(200).json({
    user: {
      id: auth.user.id,
      email: auth.user.email,
      clerkId: auth.user.clerkId,
    },
    profile,
  });
}
