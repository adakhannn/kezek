ALTER TABLE whatsapp_otp_codes
ADD COLUMN IF NOT EXISTS phone_hash TEXT,
ADD COLUMN IF NOT EXISTS phone_masked TEXT,
ADD COLUMN IF NOT EXISTS otp_hash TEXT,
ADD COLUMN IF NOT EXISTS status TEXT,
ADD COLUMN IF NOT EXISTS consumed_at TIMESTAMPTZ;

UPDATE whatsapp_otp_codes
SET status = CASE
    WHEN used_at IS NOT NULL THEN 'consumed'
    WHEN expires_at < timezone('utc'::text, now()) THEN 'expired'
    ELSE 'pending'
END
WHERE status IS NULL;

ALTER TABLE whatsapp_otp_codes
ALTER COLUMN status SET DEFAULT 'pending';

ALTER TABLE whatsapp_otp_codes
ALTER COLUMN status SET NOT NULL;

ALTER TABLE whatsapp_otp_codes
ADD CONSTRAINT whatsapp_otp_codes_status_check
CHECK (status IN ('pending', 'consumed', 'approved', 'failed', 'expired'));

CREATE INDEX IF NOT EXISTS idx_whatsapp_otp_status_expires
ON whatsapp_otp_codes (status, expires_at);

CREATE INDEX IF NOT EXISTS idx_whatsapp_otp_phone_hash
ON whatsapp_otp_codes (phone_hash);

CREATE OR REPLACE FUNCTION public.cleanup_expired_whatsapp_otp_codes(
    p_keep_minutes integer default 1440
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
    v_deleted_count integer;
begin
    delete from public.whatsapp_otp_codes
    where expires_at < timezone('utc'::text, now())
        - (greatest(p_keep_minutes, 0) || ' minutes')::interval;

    get diagnostics v_deleted_count = row_count;
    return v_deleted_count;
end;
$$;

grant execute on function public.cleanup_expired_whatsapp_otp_codes(integer) to service_role;

DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM pg_extension
        WHERE extname = 'pg_cron'
    ) THEN
        IF NOT EXISTS (
            SELECT 1
            FROM cron.job
            WHERE jobname = 'cleanup_expired_whatsapp_otp_codes_hourly'
        ) THEN
            PERFORM cron.schedule(
                'cleanup_expired_whatsapp_otp_codes_hourly',
                '0 * * * *',
                $job$select public.cleanup_expired_whatsapp_otp_codes(1440);$job$
            );
        END IF;
    END IF;
END
$$;
