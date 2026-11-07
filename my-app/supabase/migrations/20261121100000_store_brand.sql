-- Store branding: the shop's name, logo, colours and fonts as one public row, edited at /admin/branding.
-- Additive. The seed row equals the look and text that were hard-coded before, so nothing changes
-- until an admin edits it. Public SELECT (it is what every visitor sees); writes via the secret key.

create table public.store_brand (
  id               boolean primary key default true check (id),
  name             text not null default 'Northbound' check (char_length(name) between 1 and 40),
  short_name       text not null default 'Northbound' check (char_length(short_name) between 1 and 24),
  sender_name      text not null default '' check (char_length(sender_name) <= 24),
  tagline_si       text not null default 'Demo සාප්පුවකි. ඉවත දමන්න නොව, දිගු කලක් අඳින්නට.' check (char_length(tagline_si) <= 120),
  tagline_en       text not null default 'A demo storefront. Built to be worn out, not thrown out.' check (char_length(tagline_en) <= 120),
  seo_title        text not null default 'Northbound — Hard-wearing field apparel' check (char_length(seo_title) between 1 and 70),
  seo_description  text not null default 'Honest materials, quiet design, and hardware built to outlast the season. Field apparel for the cold miles.' check (char_length(seo_description) <= 200),
  logo_path        text check (logo_path is null or logo_path ~ '^[0-9]{10,16}-(logo|logoDark|favicon|share)\.(png|webp|jpg|jpeg)$'),
  logo_dark_path   text check (logo_dark_path is null or logo_dark_path ~ '^[0-9]{10,16}-(logo|logoDark|favicon|share)\.(png|webp|jpg|jpeg)$'),
  favicon_path     text check (favicon_path is null or favicon_path ~ '^[0-9]{10,16}-(logo|logoDark|favicon|share)\.(png|webp|jpg|jpeg)$'),
  share_image_path text check (share_image_path is null or share_image_path ~ '^[0-9]{10,16}-(logo|logoDark|favicon|share)\.(png|webp|jpg|jpeg)$'),
  theme_id         text not null default 'northbound' check (theme_id in ('northbound', 'paper', 'ocean', 'forest', 'rose', 'midnight')),
  accent           text check (accent is null or accent ~ '^#[0-9a-fA-F]{6}$'),
  theme_overrides  jsonb not null default '{}'::jsonb check (jsonb_typeof(theme_overrides) = 'object'),
  font_pair        text not null default 'northbound' check (font_pair in ('northbound', 'classic', 'friendly', 'modern', 'editorial')),
  updated_at       timestamptz not null default now()
);
insert into public.store_brand default values;

alter table public.store_brand enable row level security;
create policy "Store brand is publicly readable"
  on public.store_brand for select to anon, authenticated using (true);
revoke all on table public.store_brand from anon, authenticated;
grant select on table public.store_brand to anon, authenticated;

-- Logos, favicon and share image (public, PNG/WebP/JPEG, 1 MB). Uploads use signed URLs made by the server.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('brand-assets', 'brand-assets', true, 1048576, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;
