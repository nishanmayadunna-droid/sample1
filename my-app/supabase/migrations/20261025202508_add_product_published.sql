-- Admins hide products instead of deleting them. Existing products stay published.
alter table public.products
  add column published boolean not null default true;
