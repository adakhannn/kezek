create or replace function public.cleanup_expired_telegram_mobile_auth_attempts(
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
    delete from public.telegram_mobile_auth_attempts
    where expires_at < timezone('utc'::text, now())
        - (greatest(p_keep_minutes, 0) || ' minutes')::interval;

    get diagnostics v_deleted_count = row_count;
    return v_deleted_count;
end;
$$;

comment on function public.cleanup_expired_telegram_mobile_auth_attempts(integer) is
    'Deletes expired telegram_mobile_auth_attempts older than retention window (default 1440 minutes).';

grant execute on function public.cleanup_expired_telegram_mobile_auth_attempts(integer) to service_role;
