-- Product photos: up to five ordered photos per product for the product page
-- gallery. products.image_url stays and always equals the first photo, so
-- cards, the cart drawer and search are unchanged. Run by the owner in the
-- SQL editor, BEFORE the code that embeds this table is deployed.

create table public.product_images (
  id          uuid primary key default gen_random_uuid(),
  product_id  text not null references public.products (id) on delete cascade,
  path        text not null check (length(path) <= 200),
  sort_order  integer not null check (sort_order between 0 and 4),
  unique (product_id, sort_order),
  unique (product_id, path)
);

alter table public.product_images enable row level security;

create policy "Product photos are public"
  on public.product_images for select
  to anon, authenticated
  using (true);

-- One row per existing photo, taken from the bucket path in image_url.
insert into public.product_images (product_id, path, sort_order)
select id, substring(image_url from '/product-images/(.+)$'), 0
from public.products
where image_url is not null
  and substring(image_url from '/product-images/(.+)$') is not null;
