-- Bounded waves and scalar snapshots are independent of PostgREST row caps.
begin;
create function public._claim_booking_notifications(p_limit integer,p_lease_seconds integer,p_exclude_ids uuid[])
returns setof public.booking_notification_outbox language plpgsql security definer set search_path=public,pg_temp as $$
begin
    if p_limit is null or p_lease_seconds is null or p_limit not between 1 and 20 or p_lease_seconds not between 30 and 300 then
        raise exception 'INVALID_OUTBOX_CLAIM' using errcode='22023';
    end if;
    if p_exclude_ids is null or cardinality(p_exclude_ids)>100 or array_position(p_exclude_ids,null) is not null then
        raise exception 'INVALID_OUTBOX_CLAIM' using errcode='22023';
    end if;
    -- Old queued events expire rather than sending obsolete reminders months later.
    with stale as (select id from public.booking_notification_outbox where created_at<now()-interval '30 days'
        and (status='pending' or (status='processing' and lease_until<=now()))
        order by created_at for update skip locked limit p_limit)
    update public.booking_notification_outbox o set status='failed',completed_at=now(),lease_token=null,lease_until=null,
        last_error_code='event_expired' from stale s where o.id=s.id;
    -- A worker crash on its final attempt must also reach a visible dead letter.
    with exhausted as (
        select id from public.booking_notification_outbox where status='processing'
            and lease_until<=now() and attempts>=8 order by created_at for update skip locked limit p_limit
    ) update public.booking_notification_outbox o set status='failed',completed_at=now(),lease_token=null,lease_until=null,
        last_error_code='lease_expired_after_final_attempt' from exhausted e where o.id=e.id;
    return query with candidates as (
        select id from public.booking_notification_outbox
        where not(id=any(p_exclude_ids)) and created_at>=now()-interval '30 days' and attempts<8 and available_at<=now() and (status='pending' or (status='processing' and lease_until<=now()))
        order by available_at,created_at for update skip locked limit p_limit
    ) update public.booking_notification_outbox o set status='processing',attempts=o.attempts+1,
        lease_token=gen_random_uuid(),lease_until=now()+make_interval(secs=>p_lease_seconds)
        from candidates c where o.id=c.id returning o.*;
end;
$$;

create or replace function public.claim_booking_notifications(p_limit integer default 5,p_lease_seconds integer default 90)
returns setof public.booking_notification_outbox language sql security definer set search_path=public,pg_temp as $$
  select * from public._claim_booking_notifications(p_limit,p_lease_seconds,'{}');
$$;

create function public.claim_booking_notification_batch(p_limit integer,p_lease_seconds integer,p_exclude_ids uuid[])
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare v_result jsonb;
begin
  if p_limit is null or p_limit not between 1 and 2 then raise exception 'INVALID_OUTBOX_CLAIM' using errcode='22023'; end if;
  select coalesce(jsonb_agg(to_jsonb(e)),'[]') into v_result
    from public._claim_booking_notifications(p_limit,p_lease_seconds,p_exclude_ids) e;
  return v_result;
end;
$$;

create function public.read_booking_notification_deliveries(p_event_id uuid,p_lease_token uuid)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare v_event public.booking_notification_outbox; v_result jsonb;
begin
  select * into v_event from public.booking_notification_outbox where id=p_event_id for update;
  if not found or v_event.status<>'processing' or v_event.lease_token is distinct from p_lease_token or v_event.lease_until<=clock_timestamp() then
    raise exception 'OUTBOX_LEASE_LOST' using errcode='40001';
  end if;
  select coalesce(jsonb_agg(jsonb_build_object('delivery_key',d.delivery_key,'channel',d.channel,'payload',d.payload,
    'status',d.status,'sent_at',d.sent_at,'first_attempt_at',d.first_attempt_at,'last_error_code',d.last_error_code) order by d.delivery_key),'[]')
    into v_result from public.booking_notification_deliveries d where d.event_id=p_event_id;
  if jsonb_array_length(v_result)>200 then raise exception 'INVALID_OUTBOX_DELIVERIES'; end if;
  return v_result;
end;
$$;

create index booking_notification_ambiguous_event_idx on public.booking_notification_deliveries(event_id) where status='ambiguous';
create function public.booking_notification_backlog_health()
returns jsonb language sql stable security definer set search_path=public,pg_temp as $$
  with state as (select o.*, (o.attempts<8 and o.created_at>=now()-interval '30 days' and o.available_at<=now()
    and (o.status='pending' or (o.status='processing' and o.lease_until<=now()))) as due
    from public.booking_notification_outbox o)
  select jsonb_build_object('pending',count(*) filter(where status='pending'),
    'due',count(*) filter(where due),'processing',count(*) filter(where status='processing'),
    'failed',count(*) filter(where status='failed'),
    'ambiguous',count(*) filter(where exists(select 1 from public.booking_notification_deliveries d where d.event_id=state.id and d.status='ambiguous')),
    'oldest_due_age_seconds',coalesce(greatest(0,extract(epoch from now()-min(created_at) filter(where due))),0)) from state;
$$;
revoke all on function public._claim_booking_notifications(integer,integer,uuid[]),
 public.claim_booking_notification_batch(integer,integer,uuid[]),public.read_booking_notification_deliveries(uuid,uuid),public.booking_notification_backlog_health()
 from public,anon,authenticated,service_role;
grant execute on function public.claim_booking_notification_batch(integer,integer,uuid[]),
 public.read_booking_notification_deliveries(uuid,uuid),public.booking_notification_backlog_health() to service_role;
commit;
