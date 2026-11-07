-- Store branding: the text shown as the logo when no picture is uploaded (a · gets the accent colour).
-- The default keeps today's "North·bound" wordmark. Additive.

alter table public.store_brand
  add column logo_text text not null default 'North·bound' check (char_length(logo_text) between 1 and 30);
