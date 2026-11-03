-- Customer reviews (admin-approved) and per-size stock. Run by the owner in the
-- SQL editor, BEFORE the code that embeds these is deployed.

-- Reviews: one per customer per product, hidden until an admin approves it.
-- Written only by the server with the secret key; the public sees approved rows.
create table public.reviews (
  id          uuid primary key default gen_random_uuid(),
  product_id  text not null references public.products (id) on delete cascade,
  user_id     uuid not null references public.users (id) on delete cascade,
  author_name text not null check (length(author_name) between 1 and 60),
  rating      integer not null check (rating between 1 and 5),
  body        text not null check (length(body) between 1 and 1000),
  status      text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  created_at  timestamptz not null default now(),
  unique (product_id, user_id)
);

create index reviews_product_status_idx on public.reviews (product_id, status);

alter table public.reviews enable row level security;

revoke all on table public.reviews from anon, authenticated;
grant select on table public.reviews to anon, authenticated;

create policy "Approved reviews are public"
  on public.reviews for select
  to anon, authenticated
  using (status = 'approved');

-- Per-size stock, e.g. {"M": 4, "L": 0}. NULL, or a size missing from the
-- object, means "not tracked": always available. Existing products stay NULL.
alter table public.products add column stock jsonb;
