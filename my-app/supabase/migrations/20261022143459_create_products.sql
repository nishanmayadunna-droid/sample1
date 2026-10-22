-- Product catalog, read publicly by the storefront. Writes happen only via the
-- dashboard / secret key (no insert/update/delete policies or grants).

create table public.products (
  id           text primary key,
  name         text not null,
  -- Prices in cents (integers) to avoid floating-point money bugs.
  price        integer not null check (price >= 0),
  sale_price   integer check (sale_price >= 0 and sale_price < price),
  category     text not null check (category in ('Tops', 'Bottoms', 'Outerwear', 'Accessories')),
  description  text not null,
  sizes        text[] not null check (cardinality(sizes) > 0),
  material     text not null,
  construction text not null,
  origin       text not null,
  -- Two hex colors: placeholder gradient shown behind/without the image.
  swatch       text[] not null check (cardinality(swatch) = 2),
  image_url    text,
  featured     boolean not null default false,
  sort_order   integer not null default 0,
  created_at   timestamptz not null default now()
);

create index products_category_idx on public.products (category);

alter table public.products enable row level security;

create policy "Products are publicly readable"
  on public.products for select
  to anon, authenticated
  using (true);

revoke all on table public.products from anon, authenticated;
grant select on table public.products to anon, authenticated;

-- Public bucket for product photos. Public buckets serve files by URL without
-- a storage.objects SELECT policy, so the bucket contents can't be listed.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('product-images', 'product-images', true, 5242880, array['image/jpeg', 'image/png', 'image/webp']);
