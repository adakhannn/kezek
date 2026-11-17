-- WhatsApp sign-in could be captured in advance (17 Nov review, docs/PROJECT_REVIEW_2026-11-17.md
-- API-03). The owner of a WhatsApp number was looked up among all Auth users by auth.users.phone
-- (set without verification by /api/user/update-phone) or by user_metadata.phone (edited by the
-- user), so an account that wrote someone else's number there received that person's next
-- WhatsApp sign-in. The application now trusts only a verified profile link and a confirmed
-- Auth phone (find_accounts_by_contact). An unconfirmed claim can still occupy the number in
-- auth.users (users_phone_key is unique) and make the sign-in of the real owner fail when Auth
-- creates their account; after a successful WhatsApp OTP the service role releases such
-- unconfirmed claims first. A confirmed phone is never touched.
begin;

create or replace function public.release_unconfirmed_phone(p_phone_digits text)
returns integer
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
    v_count integer;
begin
    if p_phone_digits is null or p_phone_digits !~ '^[0-9]{8,15}$' then
        raise exception using errcode = '22023', message = 'INVALID_PHONE';
    end if;

    update auth.users
       set phone = null
     where phone in (p_phone_digits, '+' || p_phone_digits)
       and phone_confirmed_at is null;
    get diagnostics v_count = row_count;
    return v_count;
end;
$$;

revoke all on function public.release_unconfirmed_phone(text) from public, anon, authenticated;
grant execute on function public.release_unconfirmed_phone(text) to service_role;

commit;
