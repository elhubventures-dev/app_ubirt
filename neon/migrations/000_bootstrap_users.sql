-- Neon bootstrap: app-owned users (Clerk-synced). Apply FIRST.
-- profiles and other FKs reference public.app_users (not a view).

create extension if not exists "pgcrypto";

create schema if not exists auth;

-- Stub Supabase roles so ported GRANTs succeed on Neon
do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then
    create role anon nologin;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then
    create role authenticated nologin;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then
    create role service_role nologin bypassrls;
  end if;
end
$$;

-- Stub for ported Supabase RLS policies (server uses DATABASE_URL as owner / bypasses RLS).
create or replace function auth.uid()
returns uuid
language sql
stable
as $$
  select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid;
$$;

create table if not exists public.app_users (
  id uuid primary key default gen_random_uuid(),
  clerk_id text unique not null,
  email text unique not null,
  email_verified boolean default false,
  raw_meta jsonb default '{}'::jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists app_users_clerk_id_idx on public.app_users (clerk_id);

-- Read-compat alias used by some ported SQL comments / tooling
create or replace view auth.users as
  select
    id,
    email,
    raw_meta as raw_user_meta_data,
    created_at,
    updated_at
  from public.app_users;

comment on table public.app_users is 'Canonical user row for Neon; synced from Clerk webhooks';
