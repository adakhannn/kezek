-- PostGIS keeps spatial_ref_sys in the API-exposed public schema. Supabase creates it owned
-- by supabase_admin with every privilege granted to anon and authenticated and without RLS;
-- migrations can neither take ownership nor revoke supabase_admin's grants. As a result anyone
-- holding the public anon key could UPDATE or DELETE SRID definitions through PostgREST, e.g.
-- remove SRID 4326 and break every geography query (branch map, "nearest to me").
--
-- postgres holds TRIGGER on the table, so a guard trigger makes the table read-only for API
-- roles. Only postgres and supabase_admin (extension updates, maintenance) may change it.
-- The trigger can be dropped only by the table owner; to lift the guard, replace
-- private.reject_spatial_ref_sys_change() with a function that just returns.
begin;

create schema if not exists private;
revoke all on schema private from public;

create or replace function private.reject_spatial_ref_sys_change()
returns trigger
language plpgsql
set search_path = pg_catalog, pg_temp
as $$
begin
    if current_user not in ('postgres', 'supabase_admin') then
        raise exception 'spatial_ref_sys is read-only' using errcode = '42501';
    end if;
    return coalesce(new, old);
end;
$$;

revoke all on function private.reject_spatial_ref_sys_change() from public, anon, authenticated;

create trigger spatial_ref_sys_read_only
    before insert or update or delete on public.spatial_ref_sys
    for each row execute function private.reject_spatial_ref_sys_change();

create trigger spatial_ref_sys_no_truncate
    before truncate on public.spatial_ref_sys
    for each statement execute function private.reject_spatial_ref_sys_change();

commit;
