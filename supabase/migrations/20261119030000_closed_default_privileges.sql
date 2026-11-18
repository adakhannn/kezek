-- New objects are closed to client roles until a migration grants access (17 Nov review,
-- docs/PROJECT_REVIEW_2026-11-17.md DB-11).
--
-- The prod baseline kept the project defaults Supabase sets up: every table, view, sequence and
-- function that a migration (role postgres) creates in schema public was granted to anon and
-- authenticated, and every function was executable by PUBLIC. A new SECURITY DEFINER function was
-- callable by any visitor unless its migration remembered to revoke it, and a new table or view
-- without RLS was readable and writable by anyone. 20261117200000_close_client_write_paths removed
-- TRUNCATE, REFERENCES, TRIGGER and MAINTAIN from these defaults; this migration removes the rest.
--
-- From now on a new object in public belongs to its owner and service_role only. A migration that
-- adds something for client sessions grants exactly that, for example
--     grant select on public.new_table to authenticated;
--     grant execute on function public.new_rpc(uuid) to authenticated;
-- A function a client session evaluates indirectly (in an RLS policy, a column default, a CHECK
-- constraint or a view) needs the same explicit grant; trigger functions do not.
--
-- Existing objects keep their grants: default privileges apply only to objects created afterwards,
-- the same in production and in databases built from migrations. Objects that supabase_admin creates
-- (PostGIS and other platform extensions) follow supabase_admin's defaults, which this project
-- cannot change. Re-running these statements changes nothing.

alter default privileges for role postgres in schema public
    revoke all on tables from anon, authenticated;

alter default privileges for role postgres in schema public
    revoke all on sequences from anon, authenticated;

alter default privileges for role postgres in schema public
    revoke execute on functions from anon, authenticated;

-- PostgreSQL itself grants EXECUTE on every new function to PUBLIC. A per-schema entry cannot take
-- that away; a global entry for the role replaces the built-in default in every schema.
alter default privileges for role postgres
    revoke execute on functions from public;
