import { getApiUrl } from "@/lib/apiBase";
import { getAccessToken } from "@/lib/authToken";

async function neonRequest(body) {
  const token = await getAccessToken();
  if (!token) {
    return { data: null, error: { message: "Not authenticated" } };
  }
  const res = await fetch(getApiUrl("/api/platform/neon-rest"), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(body),
  });
  const json = await res.json().catch(() => ({ data: null, error: { message: "Invalid response" } }));
  if (!res.ok && !json.error) {
    return { data: null, error: { message: json.error || res.statusText } };
  }
  return json;
}

class FilterBuilder {
  constructor(table, state = {}) {
    this.table = table;
    this.state = {
      select: "*",
      filters: [],
      order: null,
      limit: null,
      single: false,
      maybeSingle: false,
      action: "select",
      data: null,
      upsert: false,
      onConflict: null,
      ...state,
    };
  }

  select(columns = "*") {
    const action =
      this.state.action === "insert" || this.state.action === "update" || this.state.action === "delete"
        ? this.state.action
        : "select";
    return new FilterBuilder(this.table, { ...this.state, select: columns, action });
  }

  eq(column, value) {
    return this.#addFilter(column, "eq", value);
  }

  neq(column, value) {
    return this.#addFilter(column, "neq", value);
  }

  gt(column, value) {
    return this.#addFilter(column, "gt", value);
  }

  gte(column, value) {
    return this.#addFilter(column, "gte", value);
  }

  lt(column, value) {
    return this.#addFilter(column, "lt", value);
  }

  lte(column, value) {
    return this.#addFilter(column, "lte", value);
  }

  like(column, value) {
    return this.#addFilter(column, "like", value);
  }

  ilike(column, value) {
    return this.#addFilter(column, "ilike", value);
  }

  in(column, values) {
    return this.#addFilter(column, "in", Array.isArray(values) ? values : [values]);
  }

  is(column, value) {
    return this.#addFilter(column, "is", value);
  }

  not(column, op, value) {
    if (op === "in") {
      return this.#addFilter(column, "notin", value);
    }
    return this.#addFilter(column, `not_${op}`, value);
  }

  /**
   * Minimal PostgREST or= support: `username.ilike.%q%,display_name.ilike.%q%`
   */
  or(expression) {
    return new FilterBuilder(this.table, {
      ...this.state,
      filters: [...this.state.filters, { column: "_or", op: "or", value: expression }],
    });
  }

  order(column, { ascending = true } = {}) {
    return new FilterBuilder(this.table, {
      ...this.state,
      order: { column, ascending },
    });
  }

  limit(n) {
    return new FilterBuilder(this.table, { ...this.state, limit: n });
  }

  single() {
    return new FilterBuilder(this.table, { ...this.state, single: true });
  }

  maybeSingle() {
    return new FilterBuilder(this.table, { ...this.state, single: true, maybeSingle: true });
  }

  insert(data) {
    return new FilterBuilder(this.table, { ...this.state, action: "insert", data });
  }

  upsert(data, options = {}) {
    return new FilterBuilder(this.table, {
      ...this.state,
      action: "insert",
      data,
      upsert: true,
      onConflict: options.onConflict || null,
    });
  }

  update(data) {
    return new FilterBuilder(this.table, { ...this.state, action: "update", data });
  }

  delete() {
    return new FilterBuilder(this.table, { ...this.state, action: "delete" });
  }

  #addFilter(column, op, value) {
    return new FilterBuilder(this.table, {
      ...this.state,
      filters: [...this.state.filters, { column, op, value }],
    });
  }

  then(resolve, reject) {
    return this.execute().then(resolve, reject);
  }

  async execute() {
    const result = await neonRequest({
      table: this.table,
      action: this.state.action,
      select: this.state.select,
      filters: this.state.filters,
      data: this.state.data,
      order: this.state.order,
      limit: this.state.limit,
      single: this.state.single,
      upsert: this.state.upsert,
      onConflict: this.state.onConflict,
    });
    if (this.state.maybeSingle && result.error?.code === "PGRST116") {
      return { data: null, error: null };
    }
    return result;
  }
}

export function createNeonDataClient() {
  let cachedUser = null;

  return {
    from(table) {
      return new FilterBuilder(table);
    },
    rpc(fn, args) {
      return neonRequest({ rpc: fn, args });
    },
    auth: {
      async getUser() {
        const token = await getAccessToken();
        if (!token) return { data: { user: null }, error: null };
        const res = await fetch(getApiUrl("/api/platform/me"), {
          headers: { Authorization: `Bearer ${token}` },
        });
        const json = await res.json().catch(() => ({}));
        if (!res.ok) {
          return { data: { user: null }, error: { message: json.error || "Unauthorized" } };
        }
        cachedUser = {
          id: json.user.id,
          email: json.user.email,
          user_metadata: {
            username: json.profile?.username,
            display_name: json.profile?.display_name,
            avatar_url: json.profile?.avatar_url,
          },
        };
        return { data: { user: cachedUser }, error: null };
      },
      async getSession() {
        const { data, error } = await this.getUser();
        if (error || !data.user) return { data: { session: null }, error };
        const token = await getAccessToken();
        return {
          data: {
            session: {
              access_token: token,
              user: data.user,
            },
          },
          error: null,
        };
      },
      onAuthStateChange() {
        return { data: { subscription: { unsubscribe() {} } } };
      },
      async signOut() {
        cachedUser = null;
        return { error: null };
      },
    },
    channel() {
      throw new Error("Use Ably realtime (VITE_REALTIME_PROVIDER=ably) instead of Neon channels.");
    },
    removeChannel() {},
    storage: {
      from() {
        throw new Error("Use Vercel Blob storage (VITE_STORAGE_PROVIDER=blob) in Neon mode.");
      },
    },
  };
}
