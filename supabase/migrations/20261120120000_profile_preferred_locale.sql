begin;

-- FE-10: booking notifications (email, Telegram, WhatsApp) go out in the
-- recipient's language. The site language lives in the kezek_lang cookie; this
-- column keeps the last one a signed-in user chose, so a worker without the
-- recipient's request can read it. NULL means "not known" and stays Russian.
--
-- Writes: POST /api/profile/locale updates the caller's own row with the
-- service role. No grant changes here (DB-11): the existing table privileges and
-- the "Users can update own profile" RLS policy already cover a user's own row,
-- as for notify_email and the other notification preferences, and the check
-- constraint limits the value. protect_profile_identity_columns is unchanged.
alter table public.profiles
    add column if not exists preferred_locale text null;

alter table public.profiles
    drop constraint if exists profiles_preferred_locale_check;
alter table public.profiles
    add constraint profiles_preferred_locale_check
    check (preferred_locale in ('ru', 'ky', 'en'));

comment on column public.profiles.preferred_locale is
    'Language of the user''s notifications (ru, ky, en); NULL = ru. Written by POST /api/profile/locale.';

commit;
