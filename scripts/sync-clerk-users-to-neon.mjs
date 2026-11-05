/**
 * Backfill Clerk users into Neon (for local testing when webhooks cannot reach localhost).
 * Usage: node scripts/sync-clerk-users-to-neon.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { createClerkClient } from "@clerk/backend";
import pg from "pg";

function loadEnvFile(filePath) {
  for (const line of fs.readFileSync(filePath, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (!(key in process.env)) process.env[key] = value;
  }
}

loadEnvFile(path.resolve(".env.local"));

const clerk = createClerkClient({ secretKey: process.env.CLERK_SECRET_KEY });
const client = new pg.Client({
  connectionString: process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

await client.connect();
const list = await clerk.users.getUserList({ limit: 100 });

for (const u of list.data || []) {
  const email =
    u.emailAddresses?.find((e) => e.id === u.primaryEmailAddressId)?.emailAddress ||
    u.emailAddresses?.[0]?.emailAddress;
  const displayName = [u.firstName, u.lastName].filter(Boolean).join(" ") || u.username || email;
  let username = (u.username || email?.split("@")[0] || "user")
    .toLowerCase()
    .replace(/[^a-z0-9_]/g, "_")
    .slice(0, 30);

  const userRes = await client.query(
    `insert into public.app_users (clerk_id, email, email_verified, raw_meta)
     values ($1, $2, $3, $4::jsonb)
     on conflict (clerk_id) do update set
       email = excluded.email,
       raw_meta = excluded.raw_meta,
       updated_at = now()
     returning id, email`,
    [
      u.id,
      email || `${u.id}@users.clerk.local`,
      true,
      JSON.stringify({ username, display_name: displayName, avatar_url: u.imageUrl }),
    ]
  );
  const userId = userRes.rows[0].id;

  for (let i = 0; i < 5; i += 1) {
    const candidate = i === 0 ? username : `${username}_${i + 1}`;
    try {
      await client.query(
        `insert into public.profiles (id, username, display_name, avatar_url)
         values ($1, $2, $3, $4)
         on conflict (id) do update set
           display_name = coalesce(excluded.display_name, public.profiles.display_name),
           avatar_url = coalesce(excluded.avatar_url, public.profiles.avatar_url)`,
        [userId, candidate, displayName || candidate, u.imageUrl || null]
      );
      username = candidate;
      break;
    } catch (error) {
      if (!String(error.message).includes("unique") || i === 4) throw error;
    }
  }

  console.log("synced", email, "→", userId, `@${username}`);
}

await client.end();
console.log("Done.");
