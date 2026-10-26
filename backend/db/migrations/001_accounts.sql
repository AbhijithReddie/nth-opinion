-- 001: optional user accounts (part 10a).
-- Every table is keyed by the Supabase auth user id and is removed with the user
-- (on delete cascade), so deleting the user in the Supabase dashboard deletes their data.
-- Coming next: 10b (memory) adds a memories table and uses profiles.memory_enabled;
-- 10c (decision journal) adds journal entries that can reference conversations(id).

-- Keeps updated_at current on every UPDATE.
create or replace function set_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table if not exists profiles (
  user_id            uuid primary key references auth.users (id) on delete cascade,
  display_name       text check (char_length(display_name) <= 60),
  preferred_language text check (char_length(preferred_language) <= 40),
  memory_enabled     boolean not null default false,   -- 10b: off until the user opts in
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

create table if not exists custom_personas (
  id         text not null check (id ~ '^custom_[a-z0-9]{4,16}$'),
  user_id    uuid not null references auth.users (id) on delete cascade,
  data       jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, id)
);

create table if not exists conversations (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references auth.users (id) on delete cascade,
  room_id        text not null check (char_length(room_id) <= 40),
  title          text not null check (char_length(title) <= 120),
  setup          jsonb not null default '{}'::jsonb,   -- personas, guests, language; never documents or digests
  messages       jsonb not null default '[]'::jsonb,
  result         jsonb,                                -- the room's summary (poll, offers, scorecard...)
  safety_flagged boolean not null default false,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
create index if not exists conversations_user_updated on conversations (user_id, updated_at desc);

drop trigger if exists profiles_updated_at on profiles;
create trigger profiles_updated_at before update on profiles for each row execute function set_updated_at();
drop trigger if exists custom_personas_updated_at on custom_personas;
create trigger custom_personas_updated_at before update on custom_personas for each row execute function set_updated_at();
drop trigger if exists conversations_updated_at on conversations;
create trigger conversations_updated_at before update on conversations for each row execute function set_updated_at();

-- Row Level Security: defence in depth. Only the backend connects (as the table owner,
-- which bypasses RLS) and it filters every query by the verified user id. If these tables
-- are ever reached through Supabase's own APIs, a signed-in user sees only their own rows
-- and anonymous requests see nothing.
alter table profiles enable row level security;
alter table custom_personas enable row level security;
alter table conversations enable row level security;

drop policy if exists "own profile" on profiles;
create policy "own profile" on profiles for all to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
drop policy if exists "own personas" on custom_personas;
create policy "own personas" on custom_personas for all to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
drop policy if exists "own conversations" on conversations;
create policy "own conversations" on conversations for all to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
