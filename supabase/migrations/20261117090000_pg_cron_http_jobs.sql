-- Frequent HTTP cron jobs run from the database (pg_cron + pg_net).
--
-- Vercel Hobby only allows daily crons, and GitHub delays this repository's
-- scheduled workflows by hours (the 02:00 nightly CI started around 08:30), so
-- neither can drive the booking-notification and WhatsApp-inbox workers. pg_cron
-- is already installed in production and runs reliably.
--
-- The target origin and the bearer secret are environment data, not schema:
-- they live in Supabase Vault as `kezek_cron_origin` and `kezek_cron_secret` and
-- are set outside migrations. Without them private.call_cron_endpoint does
-- nothing, so local and CI databases never call out.
begin;

create extension if not exists pg_net with schema extensions;

create schema if not exists private;
revoke all on schema private from public;

create or replace function private.call_cron_endpoint(p_path text)
returns bigint
language plpgsql
security definer
set search_path = pg_catalog, pg_temp
as $$
declare
    v_origin text;
    v_secret text;
begin
    if p_path is null or p_path !~ '^/api/cron/[a-z0-9/-]+$' then
        raise exception 'CRON_PATH_INVALID';
    end if;
    select decrypted_secret into v_origin from vault.decrypted_secrets where name = 'kezek_cron_origin';
    select decrypted_secret into v_secret from vault.decrypted_secrets where name = 'kezek_cron_secret';
    if v_origin is null or v_secret is null or v_origin !~ '^https://[^/]+$' then
        return null;
    end if;
    -- Asynchronous: pg_net performs the request in its background worker, so a
    -- slow endpoint never holds the cron job; responses land in net._http_response.
    return net.http_get(
        url := v_origin || p_path,
        headers := jsonb_build_object('Authorization', 'Bearer ' || v_secret),
        timeout_milliseconds := 60000
    );
end;
$$;

revoke all on function private.call_cron_endpoint(text) from public, anon, authenticated;

-- Two unnamed jobs ran purge_expired_holds() every minute side by side; keep one, named.
select cron.unschedule(jobid)
  from cron.job
 where jobname is null
   and command = 'select purge_expired_holds();';
select cron.schedule('purge_expired_holds', '* * * * *', 'select purge_expired_holds();');

-- cron.schedule updates a job with the same name, so re-running is idempotent.
select cron.schedule('kezek_booking_notifications', '*/2 * * * *',
    $job$select private.call_cron_endpoint('/api/cron/booking-notifications')$job$);
select cron.schedule('kezek_whatsapp_inbox', '*/2 * * * *',
    $job$select private.call_cron_endpoint('/api/cron/whatsapp-inbox')$job$);
select cron.schedule('kezek_close_shifts', '*/5 * * * *',
    $job$select private.call_cron_endpoint('/api/cron/close-shifts')$job$);

commit;
