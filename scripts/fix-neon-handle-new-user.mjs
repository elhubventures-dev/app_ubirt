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
await client.query(`
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  base_username text;
  final_username text;
begin
  base_username := lower(regexp_replace(
    coalesce(new.raw_meta->>'username', split_part(new.email, '@', 1)),
  '[^a-z0-9_]', '_', 'g'));
  if base_username = '' or base_username is null then
    base_username := 'user';
  end if;
  final_username := base_username || '_' || substr(replace(new.id::text, '-', ''), 1, 6);

  insert into public.profiles (id, username, display_name, avatar_url)
  values (
    new.id,
    final_username,
    coalesce(new.raw_meta->>'display_name', split_part(new.email, '@', 1)),
    new.raw_meta->>'avatar_url'
  )
  on conflict (id) do nothing;

  return new;
end;
$$;
`);
console.log("handle_new_user fixed (uses raw_meta)");
await client.end();
