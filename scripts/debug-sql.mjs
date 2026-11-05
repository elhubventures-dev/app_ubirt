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
const file = process.argv[2] || "neon/migrations/032_tier4_monetization.sql";
const sql = fs.readFileSync(file, "utf8");
const client = new pg.Client({
  connectionString: process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});
await client.connect();
try {
  await client.query(sql);
  console.log("ok");
} catch (e) {
  console.error(e.message);
  if (e.position) {
    const p = Number(e.position);
    console.log("--- around error ---");
    console.log(sql.slice(Math.max(0, p - 200), p + 200));
  }
}
await client.end();
