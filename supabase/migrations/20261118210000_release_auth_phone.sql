-- Unlinking WhatsApp left the number on the account (17 Nov review, docs/PROJECT_REVIEW_2026-11-17.md
-- API-10). WhatsApp sign-up creates the account with a confirmed Auth phone (auth.users.phone,
-- phone_confirmed_at, a 'phone' identity, user_metadata.phone); unlinking cleared only the profile
-- link, and since ENG-70 a confirmed Auth phone counts as ownership of the number. The next
-- WhatsApp code sent to it (to the user, or to whoever later gets a lost or recycled SIM) signed in
-- to the account and linked WhatsApp again. The GoTrue Admin API cannot drop a phone together with
-- its confirmation (an empty phone is ignored, phone_confirm: false does not unconfirm), so the
-- service role releases one number from one account here: the phone and its confirmation, a
-- pending change to it, the phone identity and the metadata copy. Nothing else on the account
-- changes (e-mail, raw_app_meta_data with its lifecycle trigger, other numbers).
begin;

create or replace function public.release_auth_phone(p_user_id uuid, p_phone_digits text)
returns integer
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
    v_count integer;
    v_spellings text[];
begin
    if p_user_id is null then
        raise exception using errcode = '22023', message = 'INVALID_USER';
    end if;
    if p_phone_digits is null or p_phone_digits !~ '^[0-9]{8,15}$' then
        raise exception using errcode = '22023', message = 'INVALID_PHONE';
    end if;
    -- GoTrue stores the number with or without '+'.
    v_spellings := array[p_phone_digits, '+' || p_phone_digits];

    update auth.users u
       set phone = case when u.phone = any (v_spellings) then null else u.phone end,
           phone_confirmed_at = case when u.phone = any (v_spellings) then null else u.phone_confirmed_at end,
           phone_change = case when u.phone_change = any (v_spellings) then '' else u.phone_change end,
           phone_change_token = case when u.phone_change = any (v_spellings) then '' else u.phone_change_token end,
           phone_change_sent_at = case when u.phone_change = any (v_spellings) then null else u.phone_change_sent_at end,
           raw_user_meta_data = case
               when regexp_replace(coalesce(u.raw_user_meta_data ->> 'phone', ''), '[^0-9]', '', 'g') = p_phone_digits
                   then u.raw_user_meta_data - 'phone'
               else u.raw_user_meta_data end
     where u.id = p_user_id
       and (u.phone = any (v_spellings)
            or u.phone_change = any (v_spellings)
            or regexp_replace(coalesce(u.raw_user_meta_data ->> 'phone', ''), '[^0-9]', '', 'g') = p_phone_digits);
    get diagnostics v_count = row_count;

    delete from auth.identities i
     where i.user_id = p_user_id
       and i.provider = 'phone'
       and (i.provider_id = any (v_spellings)
            or regexp_replace(coalesce(i.identity_data ->> 'phone', ''), '[^0-9]', '', 'g') = p_phone_digits);

    return v_count;
end;
$$;

revoke all on function public.release_auth_phone(uuid, text) from public, anon, authenticated;
grant execute on function public.release_auth_phone(uuid, text) to service_role;

commit;
