-- get_api_metrics_stats nested an aggregate (jsonb_object_agg(status_code, count(*))), so every
-- call failed with 42803 and GET /admin/api/metrics/stats answered 500. Status code counts now
-- come from a grouped sub-query; every other field of the result is unchanged.
--
-- grant_role / revoke_role (both overloads) always fail: has_role('super_admin', null) is
-- ambiguous between has_role(text, uuid) and has_role(uuid, text[]). Nothing calls them (the
-- admin UI uses grant_role_rpc), yet any signed-in account could execute them. EXECUTE now
-- belongs to the service role only.
-- Found by `supabase db lint` (plpgsql_check) on a fresh stack with all migrations.
begin;

create or replace function public.get_api_metrics_stats(
    p_endpoint text,
    p_window_minutes integer default 60,
    p_method text default null::text
)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
    v_result jsonb;
    v_window_start timestamptz;
    v_status_codes jsonb;
begin
    v_window_start := timezone('utc'::text, now()) - (p_window_minutes || ' minutes')::interval;

    select jsonb_object_agg(codes.status_code::text, codes.requests)
      into v_status_codes
      from (
            select status_code, count(*) as requests
              from public.api_request_metrics
             where endpoint = p_endpoint
               and created_at >= v_window_start
               and (p_method is null or method = p_method)
               and status_code is not null
             group by status_code
           ) codes;

    select jsonb_build_object(
        'endpoint', p_endpoint,
        'method', coalesce(p_method, 'all'),
        'window_minutes', p_window_minutes,
        'total_requests', count(*),
        'success_count', count(*) filter (where status_code < 400),
        'client_error_count', count(*) filter (where status_code >= 400 and status_code < 500),
        'server_error_count', count(*) filter (where status_code >= 500),
        'avg_duration_ms', coalesce(avg(duration_ms), 0),
        'min_duration_ms', coalesce(min(duration_ms), 0),
        'max_duration_ms', coalesce(max(duration_ms), 0),
        'p95_duration_ms', coalesce(percentile_cont(0.95) within group (order by duration_ms), 0),
        'p99_duration_ms', coalesce(percentile_cont(0.99) within group (order by duration_ms), 0),
        'error_rate', case
            when count(*) > 0 then
                round((count(*) filter (where status_code >= 400)::numeric / count(*)::numeric) * 100, 2)
            else 0
        end,
        'error_types', jsonb_agg(distinct error_type) filter (where error_type is not null),
        'status_codes', v_status_codes
    )
    into v_result
    from public.api_request_metrics
    where endpoint = p_endpoint
      and created_at >= v_window_start
      and (p_method is null or method = p_method);

    return coalesce(v_result, jsonb_build_object('error', 'No data'));
end;
$function$;

revoke all on function public.get_api_metrics_stats(text, integer, text) from public, anon, authenticated;
grant execute on function public.get_api_metrics_stats(text, integer, text) to service_role;

revoke execute on function
    public.grant_role(uuid, uuid, text),
    public.grant_role(uuid, text, uuid),
    public.revoke_role(uuid, uuid, text),
    public.revoke_role(uuid, text, uuid)
    from public, anon, authenticated;

commit;
