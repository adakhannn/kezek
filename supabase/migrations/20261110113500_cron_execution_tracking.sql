-- Durable execution evidence shared by all application instances. No job payloads,
-- user identities, credentials or provider messages are stored here.
begin;
create table public.cron_executions (
    id uuid primary key,
    job text not null check (job ~ '^[a-z][a-z0-9-]{0,63}$'),
    started_at timestamptz not null default clock_timestamp(),
    completed_at timestamptz,
    outcome text not null default 'running' check (outcome in ('running','succeeded','failed')),
    http_status integer check (http_status between 100 and 599),
    error_code text check (length(error_code)<=80),
    check ((outcome='running' and completed_at is null) or (outcome<>'running' and completed_at is not null))
);
create index cron_executions_job_started on public.cron_executions(job,started_at desc);
create index cron_executions_retention on public.cron_executions(started_at);
alter table public.cron_executions enable row level security;
revoke all on public.cron_executions from public,anon,authenticated,service_role;

create function public.start_cron_execution(p_id uuid,p_job text)
returns uuid language plpgsql security definer set search_path=pg_catalog,public as $$
declare v_job text;
begin
    if p_id is null or p_job is null or p_job !~ '^[a-z][a-z0-9-]{0,63}$' then
        raise exception using errcode='22023',message='CRON_EXECUTION_INVALID';
    end if;
    -- A terminated worker cannot leave a perpetual running badge after recovery.
    update public.cron_executions set outcome='failed',completed_at=clock_timestamp(),error_code='execution_expired'
    where job=p_job and outcome='running' and started_at<clock_timestamp()-interval '15 minutes';
    delete from public.cron_executions where id in (
        select id from public.cron_executions where started_at<clock_timestamp()-interval '30 days'
        order by started_at limit 200
    );
    insert into public.cron_executions(id,job) values(p_id,p_job) on conflict(id) do nothing;
    select job into strict v_job from public.cron_executions where id=p_id;
    if v_job<>p_job then raise exception using errcode='22023',message='CRON_EXECUTION_CONFLICT'; end if;
    return p_id;
end $$;

create function public.finish_cron_execution(p_id uuid,p_outcome text,p_http_status integer,p_error_code text default null)
returns void language plpgsql security definer set search_path=pg_catalog,public as $$
declare v_run public.cron_executions;
begin
    if p_outcome is null or p_outcome not in ('succeeded','failed') or p_http_status is null
       or p_http_status not between 100 and 599 or length(p_error_code)>80
       or (p_outcome='succeeded' and p_http_status not between 200 and 299) then
        raise exception using errcode='22023',message='CRON_EXECUTION_INVALID';
    end if;
    select * into v_run from public.cron_executions where id=p_id for update;
    if not found then raise exception using errcode='P0002',message='CRON_EXECUTION_NOT_FOUND'; end if;
    if v_run.outcome<>'running' then
        if v_run.outcome=p_outcome and v_run.http_status=p_http_status then return; end if;
        raise exception using errcode='40001',message='CRON_EXECUTION_ALREADY_FINISHED';
    end if;
    update public.cron_executions set outcome=p_outcome,http_status=p_http_status,error_code=p_error_code,
        completed_at=clock_timestamp() where id=p_id;
end $$;

create function public.read_cron_execution_health()
returns jsonb language sql stable security definer set search_path=pg_catalog,public as $$
    select coalesce(jsonb_agg(to_jsonb(s)),'[]'::jsonb) from (
        select job,max(started_at) as last_started_at,max(completed_at) as last_completed_at,
            max(completed_at) filter(where outcome='succeeded') as last_success_at,
            max(completed_at) filter(where outcome='failed') as last_failure_at,
            min(started_at) filter(where outcome='running') as oldest_running_at,
            count(*) filter(where outcome='running') as running_count
        from public.cron_executions where started_at>=now()-interval '30 days' group by job
    ) s;
$$;
revoke all on function public.start_cron_execution(uuid,text),
    public.finish_cron_execution(uuid,text,integer,text),public.read_cron_execution_health()
    from public,anon,authenticated;
grant execute on function public.start_cron_execution(uuid,text),
    public.finish_cron_execution(uuid,text,integer,text),public.read_cron_execution_health() to service_role;
commit;
