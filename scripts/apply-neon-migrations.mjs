/**
 * Apply neon/migrations/*.sql in order against DATABASE_URL_UNPOOLED (preferred) or DATABASE_URL.
 * Usage: node scripts/apply-neon-migrations.mjs
 * Loads .env.local from repo root when present.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const dir = path.join(root, "neon", "migrations");

function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return;
  const text = fs.readFileSync(filePath, "utf8");
  for (const line of text.split(/\r?\n/)) {
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

loadEnvFile(path.join(root, ".env.local"));

const connectionString =
  process.env.DATABASE_URL_UNPOOLED ||
  process.env.DATABASE_URL ||
  process.env.NEON_DATABASE_URL;

if (!connectionString) {
  console.error("Missing DATABASE_URL_UNPOOLED / DATABASE_URL");
  process.exit(1);
}

const files = fs
  .readdirSync(dir)
  .filter((f) => f.endsWith(".sql"))
  .sort();

const client = new pg.Client({
  connectionString,
  ssl: { rejectUnauthorized: false },
});

await client.connect();

await client.query(`
  create table if not exists public.schema_migrations (
    filename text primary key,
    applied_at timestamptz default now()
  );
`);

const { rows: appliedRows } = await client.query(
  `select filename from public.schema_migrations`
);
const applied = new Set(appliedRows.map((r) => r.filename));

let ok = 0;
let skipped = 0;

for (const file of files) {
  if (applied.has(file)) {
    console.log(`skip  ${file}`);
    skipped += 1;
    continue;
  }

  const sql = fs.readFileSync(path.join(dir, file), "utf8");
  process.stdout.write(`apply ${file} ... `);
  try {
    await client.query("begin");
    await client.query(sql);
    await client.query(`insert into public.schema_migrations (filename) values ($1)`, [file]);
    await client.query("commit");
    console.log("ok");
    ok += 1;
  } catch (error) {
    await client.query("rollback");
    console.log("FAIL");
    console.error(error.message);
    await client.end();
    process.exit(1);
  }
}

await client.end();
console.log(`Done. applied=${ok} skipped=${skipped} total=${files.length}`);
