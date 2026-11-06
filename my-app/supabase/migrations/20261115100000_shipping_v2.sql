-- Shipping v2 (Part 20): product weight and weight-based fees per zone. Run by
-- the owner in the SQL editor BEFORE the code that uses it is deployed.
-- Additive: with no weights and no bands the shop charges exactly the flat zone
-- fee as before. place_order is NOT changed (the fee is part of the total the
-- server computes, as in Part 12).

alter table public.products
  add column if not exists weight_grams integer
  check (weight_grams is null or weight_grams between 1 and 100000);

-- bands: [{"upToGrams": 500, "fee": 35000}, ...] ascending, fees in cents.
-- extra_per_kg: cents added for every started kilogram above the last band.
alter table public.shipping_zones
  add column if not exists bands jsonb not null default '[]'::jsonb
    check (jsonb_typeof(bands) = 'array'),
  add column if not exists extra_per_kg integer not null default 0
    check (extra_per_kg between 0 and 10000000);

-- save_shipping_zones now also takes each zone's bands and extraPerKg. A caller
-- that omits them (the code before this change) stores a flat zone, so the
-- function stays backward compatible. Same signature, so create or replace.
-- p_zones: [{"name", "fee" cents, "districts": [...], "bands": [...], "extraPerKg" cents}]

create or replace function public.save_shipping_zones(p_zones jsonb)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_zones is null or jsonb_typeof(p_zones) <> 'array' then
    raise exception 'p_zones must be a json array';
  end if;

  -- Two admins saving at once take turns.
  perform pg_advisory_xact_lock(hashtext('shipping_zones'));

  delete from public.shipping_zones where true;

  insert into public.shipping_zones (name, fee, districts, bands, extra_per_kg, sort_order)
  select
    z.value ->> 'name',
    (z.value ->> 'fee')::integer,
    coalesce(
      array(select jsonb_array_elements_text(z.value -> 'districts')),
      '{}'::text[]
    ),
    coalesce(z.value -> 'bands', '[]'::jsonb),
    coalesce((z.value ->> 'extraPerKg')::integer, 0),
    (z.ord - 1)::integer
  from jsonb_array_elements(p_zones) with ordinality as z(value, ord);
end;
$$;

revoke all on function public.save_shipping_zones(jsonb) from public, anon, authenticated;
grant execute on function public.save_shipping_zones(jsonb) to service_role;
