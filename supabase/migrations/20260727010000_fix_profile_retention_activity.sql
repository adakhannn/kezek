create or replace function public.anonymize_inactive_profiles_pii(
    p_inactive_days integer default 1095
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
    v_updated_count integer;
    v_cutoff timestamptz;
begin
    v_cutoff := timezone('utc'::text, now()) - (p_inactive_days || ' days')::interval;

    with inactive as (
        select p.id
        from public.profiles p
        join auth.users u on u.id = p.id
        where (p.full_name is not null or p.phone is not null)
          -- Account age and the latest successful sign-in are both activity.
          and u.created_at < v_cutoff
          and coalesce(u.last_sign_in_at, u.created_at) < v_cutoff
          -- Operational accounts remain identifiable while they hold access.
          and not exists (
              select 1
              from public.staff s
              where s.user_id = p.id
          )
          and not exists (
              select 1
              from public.businesses b
              where b.owner_id = p.id
          )
          and not exists (
              select 1
              from public.user_roles ur
              where ur.user_id = p.id
          )
          and not exists (
              select 1
              from public.user_global_roles ugr
              where ugr.user_id = p.id
          )
          and not exists (
              select 1
              from public.bookings b
              where b.client_id = p.id
                and b.start_at >= v_cutoff
          )
    )
    update public.profiles
    set full_name = 'Anonymized',
        phone = null
    from inactive
    where profiles.id = inactive.id;

    get diagnostics v_updated_count = row_count;
    return v_updated_count;
end;
$$;

comment on function public.anonymize_inactive_profiles_pii(integer) is
    'Anonymizes client profile PII only after the account, latest sign-in, and latest booking have all been inactive for the configured period; operational role accounts are excluded.';

grant execute on function public.anonymize_inactive_profiles_pii(integer) to service_role;
