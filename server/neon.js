import { neon } from "@neondatabase/serverless";

let sql = null;

export function isNeonConfigured() {
  return Boolean(process.env.DATABASE_URL || process.env.NEON_DATABASE_URL);
}

export function getDatabaseUrl() {
  return process.env.DATABASE_URL || process.env.NEON_DATABASE_URL || "";
}

/**
 * Tagged-template SQL client for Neon serverless Postgres.
 * @returns {ReturnType<typeof neon>}
 */
export function getNeonSql() {
  const url = getDatabaseUrl();
  if (!url) {
    throw new Error("DATABASE_URL (Neon) is not configured on the server.");
  }
  if (!sql) {
    sql = neon(url);
  }
  return sql;
}

/** Run a health query. */
export async function pingNeon() {
  const client = getNeonSql();
  const rows = await client`select 1 as ok, now() as server_time`;
  return rows?.[0] ?? null;
}

/**
 * Count rows in a public table (dual-run validation helper).
 * @param {string} table
 */
export async function countPublicTable(table) {
  const safe = String(table).replace(/[^a-z0-9_]/gi, "");
  if (!safe) throw new Error("Invalid table name");
  const client = getNeonSql();
  // Table identifier cannot be parameterized; whitelisted via sanitize above.
  const rows = await client.query(`select count(*)::int as count from public.${safe}`);
  return rows?.[0]?.count ?? 0;
}
