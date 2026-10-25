-- App accounts for Auth.js (no adapter). Read and written only by the server
-- with the secret key: RLS on, no policies, no grants for client roles.

create table public.users (
  id            uuid primary key default gen_random_uuid(),
  email         text not null unique,            -- stored trimmed + lowercased
  name          text,
  image         text,
  password_hash text,                            -- null for Google-only users
  google_id     text unique,                     -- null for password-only users
  role          text not null default 'user' check (role in ('user', 'admin')),
  created_at    timestamptz not null default now(),
  check (password_hash is not null or google_id is not null)
);

alter table public.users enable row level security;
-- No policies. Only the server's secret key can read or write this table.
revoke all on table public.users from anon, authenticated;
