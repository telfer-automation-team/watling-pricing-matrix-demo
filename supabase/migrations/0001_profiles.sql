-- ============================================================
-- Watling Pricing Matrix — auth foundation
-- Profiles table + roles + Row Level Security + auto-provision.
-- Run this in the Supabase SQL editor.
-- ============================================================

create type public.user_role as enum ('admin', 'engineer');

create table public.profiles (
  id         uuid primary key references auth.users (id) on delete cascade,
  email      text,
  full_name  text,
  role       public.user_role not null default 'engineer',
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

-- A signed-in user can read their own profile row (needed to resolve their role).
create policy "read own profile"
  on public.profiles for select
  using (auth.uid() = id);

-- Note: role changes are done by an admin from the Supabase dashboard (or a
-- future admin screen using the service role). We deliberately do NOT allow
-- users to update their own role.

-- Auto-create a profile whenever a new user signs in for the first time.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

create or replace trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ------------------------------------------------------------
-- After Andy has signed in once, make him an admin:
--   update public.profiles set role = 'admin' where email = 'andy@watling-jcb.com';
-- ------------------------------------------------------------
