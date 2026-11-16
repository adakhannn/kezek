create or replace function public.unlink_auth_identity(
    target_user_id uuid,
    target_provider text
)
returns integer
language plpgsql
security definer
set search_path = public, auth
as $$
declare
    deleted_count integer;
begin
    if target_provider not in ('google') then
        raise exception 'Unsupported auth identity provider';
    end if;

    delete from auth.identities
    where user_id = target_user_id
      and provider = target_provider;

    get diagnostics deleted_count = row_count;
    return deleted_count;
end;
$$;

revoke all on function public.unlink_auth_identity(uuid, text) from public;
revoke all on function public.unlink_auth_identity(uuid, text) from anon;
revoke all on function public.unlink_auth_identity(uuid, text) from authenticated;
grant execute on function public.unlink_auth_identity(uuid, text) to service_role;
