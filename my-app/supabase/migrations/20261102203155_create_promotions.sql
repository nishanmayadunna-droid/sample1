-- Promotions: named campaigns with a date range, a banner and rules for free
-- shipping and discounts, plus the base shipping fee. Public read of active
-- promotions only; writes through the secret key (admin pages).

alter table public.store_settings
  add column shipping_fee integer not null default 35000
  check (shipping_fee >= 0 and shipping_fee <= 10000000);

create table public.promotions (
  id              uuid primary key default gen_random_uuid(),
  slug            text not null unique
                  check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and length(slug) <= 60),
  name_si         text not null default '' check (length(name_si) <= 60),
  name_en         text not null default '' check (length(name_en) <= 60),
  starts_at       timestamptz not null default now(),
  ends_at         timestamptz,
  active          boolean not null default true,
  sort_order      integer not null default 0,
  banner_mode     text not null default 'none' check (banner_mode in ('none', 'template', 'image')),
  headline_si     text not null default '' check (length(headline_si) <= 80),
  headline_en     text not null default '' check (length(headline_en) <= 80),
  subtext_si      text not null default '' check (length(subtext_si) <= 160),
  subtext_en      text not null default '' check (length(subtext_en) <= 160),
  button_si       text not null default '' check (length(button_si) <= 30),
  button_en       text not null default '' check (length(button_en) <= 30),
  color_from      text not null default '#cb4a1c' check (color_from ~ '^#[0-9a-f]{6}$'),
  color_to        text not null default '#15231d' check (color_to ~ '^#[0-9a-f]{6}$'),
  text_color      text not null default '#ffffff' check (text_color ~ '^#[0-9a-f]{6}$'),
  image_url       text,
  image_alt_si    text not null default '' check (length(image_alt_si) <= 160),
  image_alt_en    text not null default '' check (length(image_alt_en) <= 160),
  created_at      timestamptz not null default now(),
  check (length(btrim(name_si)) > 0 or length(btrim(name_en)) > 0),
  check (ends_at is null or ends_at > starts_at)
);

create table public.promotion_rules (
  id             uuid primary key default gen_random_uuid(),
  promotion_id   uuid not null references public.promotions (id) on delete cascade,
  kind           text not null
                 check (kind in ('free_shipping', 'percent_off', 'amount_off_item', 'amount_off_order')),
  value          integer not null default 0 check (value >= 0),
  scope          text not null default 'all' check (scope in ('all', 'categories', 'products')),
  category_slugs text[] not null default '{}',
  product_ids    text[] not null default '{}',
  min_subtotal   integer not null default 0 check (min_subtotal >= 0),
  sort_order     integer not null default 0
);
create index promotion_rules_promotion_idx on public.promotion_rules (promotion_id);

alter table public.promotions enable row level security;
alter table public.promotion_rules enable row level security;
create policy "Active promotions are publicly readable"
  on public.promotions for select to anon, authenticated using (active);
create policy "Rules of active promotions are publicly readable"
  on public.promotion_rules for select to anon, authenticated
  using (exists (select 1 from public.promotions p where p.id = promotion_id and p.active));
revoke all on table public.promotions, public.promotion_rules from anon, authenticated;
grant select on table public.promotions, public.promotion_rules to anon, authenticated;

-- Replaces a promotion's rules in one transaction (admin saves).
create function public.save_promotion_rules(p_promotion_id uuid, p_rules jsonb)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
begin
  delete from public.promotion_rules where promotion_id = p_promotion_id;
  insert into public.promotion_rules
    (promotion_id, kind, value, scope, category_slugs, product_ids, min_subtotal, sort_order)
  select p_promotion_id, r.kind, r.value, r.scope,
         coalesce(r.category_slugs, '{}'), coalesce(r.product_ids, '{}'),
         r.min_subtotal, r.sort_order
  from jsonb_to_recordset(p_rules) as r(
    kind text, value integer, scope text, category_slugs text[],
    product_ids text[], min_subtotal integer, sort_order integer);
end;
$$;
revoke all on function public.save_promotion_rules(uuid, jsonb) from public, anon, authenticated;
grant execute on function public.save_promotion_rules(uuid, jsonb) to service_role;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('promotion-images', 'promotion-images', true, 5242880,
        array['image/jpeg', 'image/png', 'image/webp']);

-- Today's rule (free shipping over Rs 5,000) becomes an always-on promotion.
with seeded as (
  insert into public.promotions (slug, name_si, name_en, banner_mode)
  values ('free-shipping', 'නොමිලේ බෙදාහැරීම', 'Free shipping', 'none')
  returning id
)
insert into public.promotion_rules (promotion_id, kind, value, scope, min_subtotal)
select id, 'free_shipping', 0, 'all', 500000 from seeded;
