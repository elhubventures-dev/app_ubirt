-- Extended profile fields for edit profile
alter table public.profiles
  add column if not exists bio text,
  add column if not exists phone text,
  add column if not exists website text,
  add column if not exists location text;
