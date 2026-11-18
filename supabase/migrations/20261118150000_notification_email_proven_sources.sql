-- A notification e-mail counts as verified only when trusted state proves it (17 Nov review,
-- docs/PROJECT_REVIEW_2026-11-17.md API-08). sync_user_notification_email stored every address
-- it was given as verified, and the web re-synced user_metadata.yandex_email on every profile
-- load and Google sign-in. Users write user_metadata themselves (supabase.auth.updateUser({ data })),
-- so any account could add any address as a "verified" notification e-mail, enable it and have
-- its booking and application notifications (client names and phones for owners and staff)
-- delivered there. The web no longer reads metadata; the function now accepts an address only
-- when it matches:
--   account: auth.users.email with email_confirmed_at (the auth.users trigger runs AFTER ROW and
--            sees its own row);
--   google:  a google auth.identities row of the user with that e-mail, not marked unverified;
--   yandex:  the protected profiles.yandex_id link (written only by the Yandex OAuth callback,
--            which then syncs Yandex's own default_email) equal to provider_subject.
-- 'yandex' sources the callback could not have written are removed (none in production on
-- 18 Nov 2026). Client write grants are restated as absent (production already had none).
begin;

create or replace function public.sync_user_notification_email(
    target_user_id uuid,
    target_email text,
    target_source text,
    target_provider_subject text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
    normalized_email text := lower(btrim(target_email));
    notification_email_id uuid;
    should_enable boolean;
    proven boolean;
begin
    if target_source not in ('account', 'google', 'yandex') then
        raise exception 'Unsupported notification email source';
    end if;
    if normalized_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then
        raise exception 'Invalid notification email';
    end if;

    proven := case target_source
        when 'account' then exists (
            select 1 from auth.users u
             where u.id = target_user_id
               and lower(btrim(u.email)) = normalized_email
               and u.email_confirmed_at is not null)
        when 'google' then exists (
            select 1 from auth.identities i
             where i.user_id = target_user_id
               and i.provider = 'google'
               and lower(btrim(i.identity_data ->> 'email')) = normalized_email
               and coalesce(i.identity_data ->> 'email_verified', 'true') <> 'false')
        else exists (
            select 1 from public.profiles p
             where p.id = target_user_id
               and p.yandex_id is not null
               and p.yandex_id = target_provider_subject)
    end;
    if not proven then
        raise exception 'NOTIFICATION_EMAIL_NOT_PROVEN' using detail = target_source;
    end if;

    select not exists (
        select 1 from public.user_notification_emails where user_id = target_user_id
    ) into should_enable;

    insert into public.user_notification_emails(user_id, email, verified, enabled)
    values (target_user_id, normalized_email, true, should_enable)
    on conflict (user_id, email) do update
    set verified = true,
        updated_at = now()
    returning id into notification_email_id;

    insert into public.user_notification_email_sources(email_id, source, provider_subject)
    values (notification_email_id, target_source, target_provider_subject)
    on conflict (email_id, source) do update
    set provider_subject = excluded.provider_subject;
end;
$$;

revoke all on function public.sync_user_notification_email(uuid, text, text, text) from public, anon, authenticated;
grant execute on function public.sync_user_notification_email(uuid, text, text, text) to service_role;

revoke insert, update, delete on public.user_notification_emails from anon, authenticated;
revoke insert, update, delete on public.user_notification_email_sources from anon, authenticated;

do $$
declare
    v_users uuid[];
    v_removed integer;
begin
    with removed as (
        delete from public.user_notification_email_sources s
         using public.user_notification_emails e
         where s.email_id = e.id
           and s.source = 'yandex'
           and not exists (
               select 1 from public.profiles p
                where p.id = e.user_id
                  and p.yandex_id is not null
                  and p.yandex_id = s.provider_subject)
        returning e.user_id
    )
    select count(*), coalesce(array_agg(distinct user_id), array[]::uuid[])
      into v_removed, v_users
      from removed;

    -- Same follow-up as remove_user_notification_email_source, limited to the affected accounts.
    delete from public.user_notification_emails email
     where email.user_id = any (v_users)
       and not exists (select 1 from public.user_notification_email_sources s where s.email_id = email.id);

    update public.user_notification_emails email
       set enabled = true, updated_at = now()
     where email.id in (
         select distinct on (e.user_id) e.id
           from public.user_notification_emails e
          where e.user_id = any (v_users)
            and e.verified
            and not exists (select 1 from public.user_notification_emails x
                             where x.user_id = e.user_id and x.enabled and x.verified)
          order by e.user_id, e.created_at, e.id);

    raise notice 'API-08: removed % unproven yandex notification email source(s) for % account(s)',
        v_removed, cardinality(v_users);
end $$;

commit;
