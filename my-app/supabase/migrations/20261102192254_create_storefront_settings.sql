-- Storefront settings (one row) and the promises shown in the promise strip
-- and footer. Public read; writes only through the secret key (admin pages).
create table public.store_settings (
  id           boolean primary key default true check (id),
  default_lang text not null default 'si' check (default_lang in ('si', 'en')),
  bilingual    boolean not null default true,
  updated_at   timestamptz not null default now()
);
insert into public.store_settings default values;

create table public.store_promises (
  id         uuid primary key default gen_random_uuid(),
  icon       text not null check (icon in ('truck', 'box', 'return', 'shield', 'tag')),
  text_si    text not null default '' check (length(text_si) <= 60),
  text_en    text not null default '' check (length(text_en) <= 60),
  sort_order integer not null default 0,
  visible    boolean not null default true,
  created_at timestamptz not null default now(),
  check (length(btrim(text_si)) > 0 or length(btrim(text_en)) > 0)
);

alter table public.store_settings enable row level security;
alter table public.store_promises enable row level security;
create policy "Store settings are publicly readable"
  on public.store_settings for select to anon, authenticated using (true);
create policy "Visible promises are publicly readable"
  on public.store_promises for select to anon, authenticated using (visible);
revoke all on table public.store_settings, public.store_promises from anon, authenticated;
grant select on table public.store_settings, public.store_promises to anon, authenticated;

insert into public.store_promises (icon, text_si, text_en, sort_order) values
  ('box',    'දිවයින පුරා බෙදාහැරීම, වැඩ කරන දින 3–5', 'Island-wide delivery, 3–5 working days', 1),
  ('return', 'දින 7ක් ඇතුළත පහසු ආපසු භාරදීම',        '7-day easy returns',                     2);
