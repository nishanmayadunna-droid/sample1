-- Signed-in shoppers' carts (one row per user, whole cart as jsonb). Read and
-- written only by the server with the secret key: RLS on, no policies.

create table public.carts (
  user_id    uuid primary key references public.users(id) on delete cascade,
  lines      jsonb not null default '[]'::jsonb,   -- [{ id, size, quantity }]
  updated_at timestamptz not null default now()
);

alter table public.carts enable row level security;
-- No policies. Only the server's secret key can read or write this table.
revoke all on table public.carts from anon, authenticated;
