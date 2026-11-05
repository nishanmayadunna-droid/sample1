-- Store contact details (one public row, shown on the contact/about pages and
-- footer) and the newsletter subscriber list (private; secret key only).

create table public.store_contact (
  id            boolean primary key default true check (id),
  business_name text not null default '',
  phone         text not null default '',
  whatsapp      text not null default '',
  email         text not null default '',
  address       text not null default '',
  hours         text not null default '',
  return_days   integer not null default 7 check (return_days between 0 and 60),
  updated_at    timestamptz not null default now()
);
insert into public.store_contact default values;

alter table public.store_contact enable row level security;
create policy "Store contact is publicly readable"
  on public.store_contact for select to anon, authenticated using (true);
revoke all on table public.store_contact from anon, authenticated;
grant select on table public.store_contact to anon, authenticated;

create table public.newsletter_subscribers (
  id                uuid primary key default gen_random_uuid(),
  email             text not null,
  source            text not null default 'footer',
  unsubscribe_token text not null unique default encode(gen_random_bytes(18), 'hex'),
  created_at        timestamptz not null default now(),
  unsubscribed_at   timestamptz
);
create unique index newsletter_subscribers_email_key
  on public.newsletter_subscribers (lower(email));
create index newsletter_subscribers_created_at_idx
  on public.newsletter_subscribers (created_at desc);

alter table public.newsletter_subscribers enable row level security;
revoke all on table public.newsletter_subscribers from anon, authenticated;

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
    update newsletter_subscribers set unsubscribed_at = null where lower(email) = v_email;
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
    update newsletter_subscribers set unsubscribed_at = null where lower(email) = v_email;
  end;
  return 'subscribed';
end;
$$;

create or replace function public.unsubscribe_newsletter(p_token text)
returns text
language plpgsql
security definer
set search_path = public
as $$
begin
  update newsletter_subscribers
     set unsubscribed_at = coalesce(unsubscribed_at, now())
   where unsubscribe_token = p_token;
  if found then
    return 'ok';
  end if;
  return 'not_found';
end;
$$;

revoke all on function public.subscribe_newsletter(text, text) from public, anon, authenticated;
grant execute on function public.subscribe_newsletter(text, text) to service_role;
revoke all on function public.unsubscribe_newsletter(text) from public, anon, authenticated;
grant execute on function public.unsubscribe_newsletter(text) to service_role;
