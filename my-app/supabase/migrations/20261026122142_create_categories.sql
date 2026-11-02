-- Admin-managed product categories (step 1 of 2: expand).
-- Safe for code that still stores display names in products.category: product
-- values are left as they are; only the hard-coded CHECK list is dropped.
-- Step 2 (link_products_to_categories) converts values to slugs and adds the FK.

create table public.categories (
  slug       text primary key check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and length(slug) <= 60),
  name       text not null check (length(btrim(name)) between 1 and 40),
  swatch     text[] not null check (cardinality(swatch) = 2),
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);
create unique index categories_name_lower_idx on public.categories (lower(name));

alter table public.categories enable row level security;
create policy "Categories are publicly readable"
  on public.categories for select to anon, authenticated using (true);
revoke all on table public.categories from anon, authenticated;
grant select on table public.categories to anon, authenticated;

insert into public.categories (slug, name, swatch, sort_order) values
  ('tops',        'Tops',        array['#1e293b', '#0f172a'], 1),
  ('bottoms',     'Bottoms',     array['#3b82f6', '#1e3a8a'], 2),
  ('outerwear',   'Outerwear',   array['#4d7c0f', '#365314'], 3),
  ('accessories', 'Accessories', array['#d97706', '#78350f'], 4);

alter table public.products drop constraint products_category_check;
