-- Phone account (Part 19): link a phone number to an existing account, or change
-- it. Run by the owner in the SQL editor BEFORE the code that uses it is
-- deployed. Additive: no existing function or table behaviour changes, and the
-- feature only appears when SMS sign-in is switched on.
--
-- The SMS code itself is checked by the existing verify_phone_code (same limits
-- as sign-in); this function only moves the number, atomically.

alter table public.users add column if not exists phone_changed_at timestamptz;

-- set_user_phone: gives the user this phone (already verified by SMS code).
-- Returns 'linked' (the user had none), 'changed', 'same', 'phone_taken'
-- (another account has it), 'too_soon' (changed less than 24 hours ago) or
-- 'user_not_found'. Never raises for those, so the caller reads one word.

create or replace function public.set_user_phone(p_user_id uuid, p_phone text) returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user users%rowtype;
begin
  if p_phone is null or p_phone !~ '^07[0-9]{8}$' then
    return 'user_not_found';
  end if;

  select * into v_user from users where id = p_user_id for update;
  if not found then
    return 'user_not_found';
  end if;

  if v_user.phone = p_phone then
    return 'same';
  end if;

  if exists (select 1 from users where phone = p_phone and id <> p_user_id) then
    return 'phone_taken';
  end if;

  -- A number can be changed once a day: a stolen session cannot keep moving it.
  if v_user.phone is not null
     and v_user.phone_changed_at is not null
     and v_user.phone_changed_at > now() - interval '24 hours' then
    return 'too_soon';
  end if;

  begin
    update users set phone = p_phone, phone_changed_at = now() where id = p_user_id;
  exception when unique_violation then
    -- Someone took the number between the check and the update.
    return 'phone_taken';
  end;

  return case when v_user.phone is null then 'linked' else 'changed' end;
end;
$$;

revoke all on function public.set_user_phone(uuid, text) from public, anon, authenticated;
grant execute on function public.set_user_phone(uuid, text) to service_role;
