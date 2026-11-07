import { getNeonSql } from "./neon.js";

/** Tables the SPA may touch via /api/platform/neon-rest (expand as needed). */
export const ALLOWED_TABLES = new Set([
  "profiles",
  "posts",
  "post_likes",
  "post_bookmarks",
  "comments",
  "conversations",
  "conversation_members",
  "messages",
  "message_hides",
  "message_reactions",
  "notifications",
  "follows",
  "uploads",
  "transactions",
  "achievements",
  "user_achievements",
  "ai_messages",
  "ai_conversations",
  "push_tokens",
  "device_tokens",
  "gifts",
  "poll_votes",
  "poll_options",
  "post_polls",
  "profile_questions",
  "app_users",
  "blocked_users",
  "reports",
  "creator_subscriptions",
  "wallet_ledger",
  "notification_preferences",
  "hashtags",
  "post_hashtags",
  "calls",
  "call_sessions",
]);

const FILTER_OPS = {
  eq: "=",
  neq: "<>",
  gt: ">",
  gte: ">=",
  lt: "<",
  lte: "<=",
  like: "like",
  ilike: "ilike",
};

function assertIdent(name, label = "identifier") {
  if (!/^[a-z_][a-z0-9_]*$/i.test(name)) {
    throw new Error(`Invalid ${label}: ${name}`);
  }
  return name;
}

function parseInList(value) {
  if (Array.isArray(value)) return value;
  if (typeof value === "string") {
    const trimmed = value.trim().replace(/^\(/, "").replace(/\)$/, "");
    if (!trimmed) return [];
    return trimmed.split(",").map((v) => v.trim().replace(/^"|"$/g, ""));
  }
  return [value];
}

function buildWhere(filters, values) {
  const parts = [];
  for (const f of filters) {
    if (f.op === "or" || f.column === "_or") {
      // username.ilike.%q%,display_name.ilike.%q%
      const expr = String(f.value || "");
      const orParts = [];
      for (const piece of expr.split(",")) {
        const m = piece.trim().match(/^([a-z_][a-z0-9_]*)\.(eq|neq|gt|gte|lt|lte|like|ilike)\.(.+)$/i);
        if (!m) continue;
        const col = assertIdent(m[1]);
        const op = FILTER_OPS[m[2].toLowerCase()];
        values.push(m[3]);
        orParts.push(`${col} ${op} $${values.length}`);
      }
      if (orParts.length) parts.push(`(${orParts.join(" or ")})`);
      continue;
    }

    const col = assertIdent(f.column, "column");

    if (f.op === "in") {
      const list = parseInList(f.value);
      if (!list.length) {
        parts.push("false");
        continue;
      }
      const placeholders = list.map((item) => {
        values.push(item);
        return `$${values.length}`;
      });
      parts.push(`${col} in (${placeholders.join(",")})`);
      continue;
    }

    if (f.op === "notin") {
      const list = parseInList(f.value);
      if (!list.length) continue;
      const placeholders = list.map((item) => {
        values.push(item);
        return `$${values.length}`;
      });
      parts.push(`${col} not in (${placeholders.join(",")})`);
      continue;
    }

    if (f.op === "is") {
      if (f.value === null) parts.push(`${col} is null`);
      else if (f.value === true) parts.push(`${col} is true`);
      else if (f.value === false) parts.push(`${col} is false`);
      else {
        values.push(f.value);
        parts.push(`${col} = $${values.length}`);
      }
      continue;
    }

    const op = FILTER_OPS[f.op] || FILTER_OPS.eq;
    values.push(f.value);
    parts.push(`${col} ${op} $${values.length}`);
  }
  return parts.length ? ` where ${parts.join(" and ")}` : "";
}

/**
 * Execute a constrained REST-like query against Neon.
 */
export async function runNeonRest(payload) {
  const table = assertIdent(payload.table, "table");
  if (!ALLOWED_TABLES.has(table)) {
    throw new Error(`Table not allowed: ${table}`);
  }

  const sql = getNeonSql();
  const action = payload.action;
  const filters = Array.isArray(payload.filters) ? payload.filters : [];
  const values = [];
  const whereSql = buildWhere(filters, values);

  if (action === "select") {
    const cols = (payload.select || "*")
      .split(",")
      .map((c) => c.trim())
      .filter(Boolean)
      .map((c) => {
        if (c === "*") return "*";
        // PostgREST embeds / aliases unsupported — skip fragments from nested selects
        if (c.includes("(") || c.includes("!") || c.includes(".") || c.includes(")")) return null;
        return assertIdent(c, "select column");
      })
      .filter(Boolean)
      .join(", ") || "*";

    let q = `select ${cols} from public.${table}${whereSql}`;
    if (payload.order?.column) {
      const oc = assertIdent(payload.order.column, "order column");
      q += ` order by ${oc} ${payload.order.ascending === false ? "desc" : "asc"}`;
    }
    if (payload.limit) {
      q += ` limit ${Math.min(Number(payload.limit) || 50, 500)}`;
    }
    const rows = await sql.query(q, values);
    if (payload.single) {
      return {
        data: rows?.[0] ?? null,
        error: rows?.[0] ? null : { message: "Not found", code: "PGRST116" },
      };
    }
    return { data: rows ?? [], error: null };
  }

  if (action === "insert") {
    const rowsIn = Array.isArray(payload.data) ? payload.data : [payload.data];
    if (!rowsIn.length || !rowsIn[0]) throw new Error("insert requires data");
    const keys = Object.keys(rowsIn[0]).map((k) => assertIdent(k, "column"));
    const insertValues = [];
    const placeholders = rowsIn.map((row) => {
      const parts = keys.map((k) => {
        let value = row[k];
        if (value !== null && typeof value === "object" && !(value instanceof Date)) {
          value = JSON.stringify(value);
        }
        insertValues.push(value);
        return `$${insertValues.length}`;
      });
      return `(${parts.join(",")})`;
    });

    let q = `insert into public.${table} (${keys.join(",")}) values ${placeholders.join(",")}`;
    if (payload.upsert) {
      const conflict = payload.onConflict
        ? payload.onConflict
            .split(",")
            .map((c) => assertIdent(c.trim()))
            .join(", ")
        : keys[0];
      const updates = keys.map((k) => `${k} = excluded.${k}`).join(", ");
      q += ` on conflict (${conflict}) do update set ${updates}`;
    }
    q += " returning *";
    const rows = await sql.query(q, insertValues);
    if (payload.single) return { data: rows?.[0] ?? null, error: null };
    return { data: rows ?? [], error: null };
  }

  if (action === "update") {
    if (!payload.data || typeof payload.data !== "object") throw new Error("update requires data");
    if (!filters.length) throw new Error("update requires filters");
    const keys = Object.keys(payload.data).map((k) => assertIdent(k, "column"));
    const updateValues = [];
    const setParts = keys.map((k) => {
      updateValues.push(payload.data[k]);
      return `${k} = $${updateValues.length}`;
    });
    const whereSql2 = buildWhere(filters, updateValues);
    const q = `update public.${table} set ${setParts.join(", ")}${whereSql2} returning *`;
    const rows = await sql.query(q, updateValues);
    if (payload.single) return { data: rows?.[0] ?? null, error: null };
    return { data: rows ?? [], error: null };
  }

  if (action === "delete") {
    if (!filters.length) throw new Error("delete requires filters");
    const q = `delete from public.${table}${whereSql} returning *`;
    const rows = await sql.query(q, values);
    return { data: rows ?? [], error: null };
  }

  throw new Error(`Unsupported action: ${action}`);
}

export const ALLOWED_RPCS = new Set([
  "create_notification",
  "unlock_achievement",
  "unlock_badge",
  "convert_gift_coins",
  "confirm_age_gate",
]);

/**
 * @param {string} name
 * @param {Record<string, unknown>} [args]
 * @param {{ userId?: string }} [ctx] — authenticated app user id (Clerk→Neon UUID)
 */
export async function runNeonRpc(name, args = {}, ctx = {}) {
  const fn = assertIdent(name, "rpc");
  if (!ALLOWED_RPCS.has(fn)) {
    throw new Error(`RPC not allowed: ${fn}`);
  }
  const sql = getNeonSql();

  // Neon has no Supabase auth.uid() — implement identity-bound RPCs with ctx.userId.
  if (fn === "confirm_age_gate") {
    if (!ctx.userId) throw new Error("Not authenticated");
    const rows = await sql`
      update public.profiles
      set age_confirmed_at = coalesce(age_confirmed_at, now())
      where id = ${ctx.userId}::uuid
      returning age_confirmed_at
    `;
    if (!rows?.[0]) throw new Error("Profile not found");
    return { data: rows[0].age_confirmed_at, error: null };
  }

  const keys = Object.keys(args);
  const values = keys.map((k) => args[k]);
  const argList = keys.map((k, i) => `${assertIdent(k)} := $${i + 1}`).join(", ");
  const q = keys.length
    ? `select * from public.${fn}(${argList})`
    : `select * from public.${fn}()`;
  const rows = await sql.query(q, values);
  return { data: rows?.[0] ?? rows, error: null };
}
