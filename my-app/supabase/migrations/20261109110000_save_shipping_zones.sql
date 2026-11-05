-- Saves the shipping zones in one transaction (admin saves), so a failure
-- changes nothing instead of leaving the table empty.
-- p_zones: [{"name": text, "fee": integer cents, "districts": [text]}, ...] in display order.

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

  insert into public.shipping_zones (name, fee, districts, sort_order)
  select
    z.value ->> 'name',
    (z.value ->> 'fee')::integer,
    coalesce(
      array(select jsonb_array_elements_text(z.value -> 'districts')),
      '{}'::text[]
    ),
    (z.ord - 1)::integer
  from jsonb_array_elements(p_zones) with ordinality as z(value, ord);
end;
$$;

revoke all on function public.save_shipping_zones(jsonb) from public, anon, authenticated;
grant execute on function public.save_shipping_zones(jsonb) to service_role;
