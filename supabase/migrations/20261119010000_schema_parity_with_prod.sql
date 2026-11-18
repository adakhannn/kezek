-- Fresh and CI databases differed from production (17 Nov review, docs/PROJECT_REVIEW_2026-11-17.md
-- DB-15). A catalogue comparison on 2026-11-18 (columns, constraints, indexes, function bodies,
-- RLS flags, policies, triggers) found three differences, all from changes made in production by
-- hand or in a different order; everything else matched.
--   * auth.users had the e-mail sync trigger only in production, so fresh databases never filled
--     user_notification_emails for new or changed sign-in addresses;
--   * the avatars bucket and its storage policies existed only in production - and three of the
--     policies let ANY signed-in user upload, overwrite or delete ANY object in the bucket (they
--     checked bucket_id only). Staff photos are uploaded and removed only by the server with the
--     service role (lib/staffAvatar*Service.ts), which bypasses these policies, and the public
--     bucket serves files by URL without a read policy, so all four policies go;
--   * public.telegram_mobile_auth_attempts lacked the restrictive lifecycle policy in fresh
--     databases (its RLS is enabled by 20261116120000, after the lifecycle migration created the
--     policies; production had it).
-- Each step is idempotent: production keeps its trigger and gains nothing twice.
begin;

set local lock_timeout = '5s';

do $$
begin
    if not exists (
        select 1 from pg_trigger
        where tgrelid = 'auth.users'::regclass
          and tgname = 'sync_auth_user_notification_email_trigger'
          and not tgisinternal
    ) then
        create trigger sync_auth_user_notification_email_trigger
            after insert or update of email, email_confirmed_at on auth.users
            for each row execute function public.sync_auth_user_notification_email();
    end if;
end;
$$;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('avatars', 'avatars', true, 52428800, array['image/jpeg', 'image/png', 'image/gif', 'image/webp'])
on conflict (id) do nothing;

drop policy if exists "Allow authenticated upload to avatars" on storage.objects;
drop policy if exists "Allow authenticated update in avatars" on storage.objects;
drop policy if exists "Allow authenticated delete from avatars" on storage.objects;
drop policy if exists "Allow public read from avatars" on storage.objects;

do $$
begin
    if not exists (
        select 1 from pg_policies
        where schemaname = 'public' and tablename = 'telegram_mobile_auth_attempts' and policyname = 'kezek_lifecycle_access'
    ) then
        create policy kezek_lifecycle_access on public.telegram_mobile_auth_attempts
            as restrictive for all to authenticated
            using ((select public.user_lifecycle_access_allowed()))
            with check ((select public.user_lifecycle_access_allowed()));
    end if;
end;
$$;

commit;
