-- The public subscribe form must never undo an opt-out: an address that already
-- exists (subscribed or unsubscribed) is left untouched. Only the unsubscribe
-- link's token flow changes unsubscribed_at.
create or replace function public.subscribe_newsletter(p_email text, p_source text)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_email text := lower(btrim(p_email));
begin
  if exists (select 1 from newsletter_subscribers where lower(email) = v_email) then
    return 'subscribed';
  end if;

  if (select count(*) from newsletter_subscribers
        where created_at > now() - interval '24 hours') >= 500 then
    return 'busy';
  end if;

  begin
    insert into newsletter_subscribers (email, source)
    values (v_email, coalesce(nullif(btrim(p_source), ''), 'footer'));
  exception when unique_violation then
    null;
  end;
  return 'subscribed';
end;
$$;

revoke all on function public.subscribe_newsletter(text, text) from public, anon, authenticated;
grant execute on function public.subscribe_newsletter(text, text) to service_role;
