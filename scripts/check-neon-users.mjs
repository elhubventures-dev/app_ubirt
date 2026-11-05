import fs from "node:fs";
import path from "node:path";
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

const client = new pg.Client({
  connectionString: process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

await client.connect();
const users = await client.query(
  `select id, clerk_id, email, created_at from public.app_users order by created_at desc limit 10`
);
const profiles = await client.query(
  `select id, username, display_name, created_at from public.profiles order by created_at desc limit 10`
);
console.log("app_users:", users.rows.length);
console.table(users.rows);
console.log("profiles:", profiles.rows.length);
console.table(profiles.rows);
await client.end();
