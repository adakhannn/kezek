-- RLS policy hygiene (17 Nov review, docs/PROJECT_REVIEW_2026-11-17.md DB-09).
--
-- 1. Policies that can never apply. Four are granted to service_role, which bypasses RLS
--    (rolbypassrls), so PostgreSQL never consults them. Nine are permissive policies for commands
--    no client role holds the privilege for since 20261117200000_close_client_write_paths
--    (UPDATE on businesses; DELETE on user_roles, user_global_roles and super_admins_legacy;
--    INSERT on frontend_metrics). They only waited for a future GRANT to become live again, and
--    most of them test auth.role() = 'service_role', which service_role never needs.
drop policy if exists "Analytics events select all for service_role" on public.analytics_events;
drop policy if exists "Staff shift aggregates service_role all" on public.staff_shift_aggregates;
drop policy if exists "Telegram auth audit insert service role" on public.telegram_auth_audit_log;
drop policy if exists "Telegram auth audit select service role" on public.telegram_auth_audit_log;
drop policy if exists businesses_srv_cascade_upd on public.businesses;
drop policy if exists srv_upd_businesses on public.businesses;
drop policy if exists "Allow insert access to frontend metrics" on public.frontend_metrics;
drop policy if exists srv_del_super_admins_legacy on public.super_admins_legacy;
drop policy if exists super_admins_legacy_srv_cascade_del on public.super_admins_legacy;
drop policy if exists srv_del_user_global_roles on public.user_global_roles;
drop policy if exists user_global_roles_srv_cascade_del on public.user_global_roles;
drop policy if exists srv_del_user_roles on public.user_roles;
drop policy if exists user_roles_srv_cascade_del on public.user_roles;

-- 2. auth.uid(), auth.jwt() and auth.role() inside a policy are evaluated for every row the
--    statement reads. Written as (select auth.uid()) they become an InitPlan evaluated once per
--    statement, with the same result: the functions read only the request's JWT claims. Every
--    policy in public is rewritten from its stored expression; an expression that is already
--    wrapped deparses as "( SELECT auth.uid() AS uid)" and is left alone, so re-running changes
--    nothing.
do $policies$
declare
    p record;
    v_using text;
    v_check text;
    v_sql text;
begin
    for p in
        select pol.polname, c.relname,
               pg_get_expr(pol.polqual, pol.polrelid) as using_expr,
               pg_get_expr(pol.polwithcheck, pol.polrelid) as check_expr
          from pg_policy pol
          join pg_class c on c.oid = pol.polrelid
          join pg_namespace n on n.oid = c.relnamespace
         where n.nspname = 'public'
         order by c.relname, pol.polname
    loop
        v_using := regexp_replace(p.using_expr, '(?<!SELECT )auth\.(uid|jwt|role)\(\)', '(select auth.\1())', 'g');
        v_check := regexp_replace(p.check_expr, '(?<!SELECT )auth\.(uid|jwt|role)\(\)', '(select auth.\1())', 'g');
        if v_using is distinct from p.using_expr or v_check is distinct from p.check_expr then
            v_sql := format('alter policy %I on public.%I', p.polname, p.relname);
            if p.using_expr is not null then v_sql := v_sql || format(' using (%s)', v_using); end if;
            if p.check_expr is not null then v_sql := v_sql || format(' with check (%s)', v_check); end if;
            execute v_sql;
        end if;
    end loop;
end
$policies$;
