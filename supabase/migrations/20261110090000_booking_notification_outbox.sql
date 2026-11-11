-- Booking changes and delivery intent commit together. Only trusted workers can
-- claim jobs or inspect persisted provider payloads; no network work runs in SQL.
begin;
alter table public.bookings add column if not exists notification_revision bigint not null default 0;

create table public.booking_notification_outbox (
    id uuid primary key default gen_random_uuid(),
    booking_id uuid not null references public.bookings(id) on delete cascade,
    booking_revision bigint not null,
    event_type text not null check (event_type in ('hold','confirm','cancel')),
    status text not null default 'pending' check (status in ('pending','processing','sent','obsolete','failed')),
    available_at timestamptz not null default now(),
    attempts integer not null default 0 check (attempts >= 0),
    lease_token uuid,
    lease_until timestamptz,
    prepared_at timestamptz,
    last_error_code text,
    created_at timestamptz not null default now(),
    completed_at timestamptz,
    payloads_pruned_at timestamptz,
    unique (booking_id,booking_revision,event_type)
);
create index booking_notification_outbox_ready on public.booking_notification_outbox (available_at,created_at)
    where status in ('pending','processing');
alter table public.booking_notification_outbox enable row level security;

create table public.booking_notification_deliveries (
    event_id uuid not null references public.booking_notification_outbox(id) on delete cascade,
    delivery_key text not null check (delivery_key ~ '^[a-z]+:[a-f0-9]{64}$'),
    channel text not null check (channel in ('email','telegram','whatsapp')),
    payload jsonb not null check (jsonb_typeof(payload)='object'),
    sent_at timestamptz,
    provider_id text,
    status text not null default 'pending' check(status in ('pending','sending','sent','failed','ambiguous')),
    first_attempt_at timestamptz,
    attempts integer not null default 0,
    last_error_code text,
    primary key(event_id,delivery_key)
);
alter table public.booking_notification_deliveries enable row level security;
revoke all on public.booking_notification_outbox,public.booking_notification_deliveries from public,anon,authenticated,service_role;
grant select on public.booking_notification_outbox,public.booking_notification_deliveries to service_role;

create function public.booking_notification_revision_guard()
returns trigger language plpgsql set search_path=public,pg_temp as $$
begin
    if tg_op='INSERT' then new.notification_revision:=0;
    elsif (new.status,new.start_at,new.end_at,new.staff_id,new.branch_id,new.biz_id,new.service_id)
        is distinct from (old.status,old.start_at,old.end_at,old.staff_id,old.branch_id,old.biz_id,old.service_id) then
        new.notification_revision:=old.notification_revision+1;
    else new.notification_revision:=old.notification_revision;
    end if;
    return new;
end;
$$;
create trigger booking_notification_revision before insert or update on public.bookings
for each row execute function public.booking_notification_revision_guard();

create function public.enqueue_booking_notification(p_booking_id uuid,p_type text)
returns uuid language plpgsql security definer set search_path=public,pg_temp as $$
declare v_status text; v_revision bigint; v_id uuid;
begin
    select status::text,notification_revision into v_status,v_revision from public.bookings where id=p_booking_id;
    if not found then raise exception 'NOTIFICATION_BOOKING_NOT_FOUND' using errcode='P0002'; end if;
    if not ((p_type='hold' and v_status in ('hold','pending_hold')) or (p_type='confirm' and v_status='confirmed')
        or (p_type='cancel' and v_status='cancelled')) then
        raise exception 'NOTIFICATION_STATE_MISMATCH' using errcode='22023';
    end if;
    insert into public.booking_notification_outbox(booking_id,booking_revision,event_type)
        values(p_booking_id,v_revision,p_type) on conflict (booking_id,booking_revision,event_type) do nothing returning id into v_id;
    if v_id is null then
        select id into v_id from public.booking_notification_outbox
            where booking_id=p_booking_id and booking_revision=v_revision and event_type=p_type;
    end if;
    return v_id;
end;
$$;

create function public.booking_notification_enqueue_trigger()
returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
declare v_type text;
begin
    if tg_op='UPDATE' and new.notification_revision=old.notification_revision then return new; end if;
    v_type:=case new.status::text when 'hold' then 'hold' when 'pending_hold' then 'hold' when 'confirmed' then 'confirm' when 'cancelled' then 'cancel' end;
    if v_type is not null then perform public.enqueue_booking_notification(new.id,v_type); end if;
    return new;
end;
$$;
create trigger booking_notification_enqueue after insert or update on public.bookings
for each row execute function public.booking_notification_enqueue_trigger();

create function public.claim_booking_notifications(p_limit integer default 5,p_lease_seconds integer default 90)
returns setof public.booking_notification_outbox language plpgsql security definer set search_path=public,pg_temp as $$
begin
    if p_limit is null or p_lease_seconds is null or p_limit not between 1 and 20 or p_lease_seconds not between 30 and 300 then
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
        where created_at>=now()-interval '30 days' and attempts<8 and available_at<=now() and (status='pending' or (status='processing' and lease_until<=now()))
        order by available_at,created_at for update skip locked limit p_limit
    ) update public.booking_notification_outbox o set status='processing',attempts=o.attempts+1,
        lease_token=gen_random_uuid(),lease_until=now()+make_interval(secs=>p_lease_seconds)
        from candidates c where o.id=c.id returning o.*;
end;
$$;

-- The first worker persists the complete provider payloads. Retries reuse these
-- exact payloads and stable delivery keys, including email idempotency keys.
create function public.prepare_booking_notification_deliveries(p_event_id uuid,p_lease_token uuid,p_deliveries jsonb)
returns void language plpgsql security definer set search_path=public,pg_temp as $$
declare v_event public.booking_notification_outbox; v_delivery jsonb;
begin
    select * into v_event from public.booking_notification_outbox where id=p_event_id for update;
    if not found or v_event.status<>'processing' or v_event.lease_token is distinct from p_lease_token or v_event.lease_until<=clock_timestamp() then
        raise exception 'OUTBOX_LEASE_LOST' using errcode='40001';
    end if;
    if not exists(select 1 from public.bookings where id=v_event.booking_id and notification_revision=v_event.booking_revision) then
        raise exception 'OUTBOX_EVENT_OBSOLETE' using errcode='40001';
    end if;
    if v_event.prepared_at is not null then return; end if;
    if p_deliveries is null or jsonb_typeof(p_deliveries)<>'array' or jsonb_array_length(p_deliveries)>200 then
        raise exception 'INVALID_OUTBOX_DELIVERIES' using errcode='22023';
    end if;
    for v_delivery in select value from jsonb_array_elements(p_deliveries) loop
        if octet_length((v_delivery->'payload')::text)>262144 then
            raise exception 'OUTBOX_PAYLOAD_TOO_LARGE' using errcode='22023';
        end if;
        insert into public.booking_notification_deliveries(event_id,delivery_key,channel,payload)
            values(p_event_id,v_delivery->>'key',v_delivery->>'channel',v_delivery->'payload');
    end loop;
    update public.booking_notification_outbox set prepared_at=now() where id=p_event_id;
end;
$$;

-- Persist the attempt before touching a provider. A crash between provider
-- acceptance and receipt storage must never silently resend a non-idempotent call.
create function public.begin_booking_notification_delivery(p_event_id uuid,p_lease_token uuid,p_delivery_key text)
returns text language plpgsql security definer set search_path=public,pg_temp as $$
declare v_event public.booking_notification_outbox; v_delivery public.booking_notification_deliveries;
begin
    select * into v_event from public.booking_notification_outbox where id=p_event_id for update;
    if not found or v_event.status<>'processing' or v_event.lease_token is distinct from p_lease_token or v_event.lease_until<=clock_timestamp()+interval '15 seconds' then
        raise exception 'OUTBOX_LEASE_LOST' using errcode='40001';
    end if;
    if not exists(select 1 from public.bookings where id=v_event.booking_id and notification_revision=v_event.booking_revision) then
        return 'obsolete';
    end if;
    select * into v_delivery from public.booking_notification_deliveries where event_id=p_event_id and delivery_key=p_delivery_key for update;
    if not found then raise exception 'OUTBOX_DELIVERY_NOT_FOUND' using errcode='P0002'; end if;
    if v_delivery.status in ('sent','failed','ambiguous') then return v_delivery.status; end if;
    if (v_delivery.channel<>'email' and v_delivery.status='sending') or
       (v_delivery.channel='email' and v_delivery.first_attempt_at<=now()-interval '23 hours') then
        update public.booking_notification_deliveries set status='ambiguous',last_error_code='provider_outcome_unknown'
            where event_id=p_event_id and delivery_key=p_delivery_key;
        return 'ambiguous';
    end if;
    update public.booking_notification_deliveries set status='sending',attempts=attempts+1,
        first_attempt_at=coalesce(first_attempt_at,now()) where event_id=p_event_id and delivery_key=p_delivery_key;
    return 'send';
end;
$$;

create function public.fail_booking_notification_delivery(p_event_id uuid,p_lease_token uuid,p_delivery_key text,p_outcome text,p_error_code text)
returns void language plpgsql security definer set search_path=public,pg_temp as $$
declare v_event public.booking_notification_outbox;
begin
    select * into v_event from public.booking_notification_outbox where id=p_event_id for update;
    if not found or v_event.status<>'processing' or v_event.lease_token is distinct from p_lease_token or v_event.lease_until<=clock_timestamp() then
        raise exception 'OUTBOX_LEASE_LOST' using errcode='40001';
    end if;
    if p_outcome is null or p_outcome not in ('retry','failed','ambiguous') then raise exception 'INVALID_DELIVERY_OUTCOME' using errcode='22023'; end if;
    update public.booking_notification_deliveries set status=case when p_outcome='retry' then 'pending' else p_outcome end,
        last_error_code=left(p_error_code,120)
        where event_id=p_event_id and delivery_key=p_delivery_key and status='sending';
    if not found then raise exception 'OUTBOX_DELIVERY_NOT_SENDING' using errcode='P0002'; end if;
end;
$$;

create function public.record_booking_notification_delivery(p_event_id uuid,p_lease_token uuid,p_delivery_key text,p_provider_id text default null)
returns void language plpgsql security definer set search_path=public,pg_temp as $$
declare v_event public.booking_notification_outbox;
begin
    select * into v_event from public.booking_notification_outbox where id=p_event_id for update;
    if not found or v_event.status<>'processing' or v_event.lease_token is distinct from p_lease_token or v_event.lease_until<=clock_timestamp() then
        raise exception 'OUTBOX_LEASE_LOST' using errcode='40001';
    end if;
    update public.booking_notification_deliveries set status='sent',sent_at=coalesce(sent_at,now()),provider_id=coalesce(provider_id,left(p_provider_id,200))
        where event_id=p_event_id and delivery_key=p_delivery_key and status in ('sending','sent');
    if not found then raise exception 'OUTBOX_DELIVERY_NOT_FOUND' using errcode='P0002'; end if;
end;
$$;

create function public.finish_booking_notification(p_event_id uuid,p_lease_token uuid,p_outcome text,p_error_code text default null,p_retry_after_seconds integer default 0)
returns void language plpgsql security definer set search_path=public,pg_temp as $$
declare v_event public.booking_notification_outbox; v_status text;
begin
    select * into v_event from public.booking_notification_outbox where id=p_event_id for update;
    if not found or v_event.status<>'processing' or v_event.lease_token is distinct from p_lease_token or v_event.lease_until<=clock_timestamp() then
        raise exception 'OUTBOX_LEASE_LOST' using errcode='40001';
    end if;
    if p_outcome is null or p_outcome not in ('sent','retry','continue','obsolete','failed') then raise exception 'INVALID_OUTBOX_OUTCOME' using errcode='22023'; end if;
    if p_outcome='sent' and (v_event.prepared_at is null or exists(
        select 1 from public.booking_notification_deliveries where event_id=p_event_id and sent_at is null
    )) then raise exception 'OUTBOX_DELIVERIES_PENDING' using errcode='22023'; end if;
    v_status:=case when p_outcome='continue' then 'pending' when p_outcome='retry' then case when v_event.attempts>=8 then 'failed' else 'pending' end else p_outcome end;
    update public.booking_notification_outbox set status=v_status,lease_token=null,lease_until=null,
        attempts=case when p_outcome='continue' then greatest(attempts-1,0) else attempts end,
        last_error_code=left(p_error_code,120),completed_at=case when v_status='pending' then null else now() end,
        available_at=case when p_outcome='continue' then now() else now()+make_interval(secs=>greatest(least(coalesce(p_retry_after_seconds,0),3600),least(3600,15*(2^least(v_event.attempts,8))::integer))) end
        where id=p_event_id;
end;
$$;

-- Bound retained delivery payloads (which contain recipient PII). Failed jobs
-- remain visible. Keep the event tombstone so a later enqueue of the same booking
-- revision cannot resend after retention; only recipient payloads/receipts expire.
create function public.prune_booking_notifications(p_limit integer default 1000)
returns integer language plpgsql security definer set search_path=public,pg_temp as $$
declare v_count integer;
begin
    if p_limit is null or p_limit not between 1 and 5000 then raise exception 'INVALID_OUTBOX_PRUNE_LIMIT' using errcode='22023'; end if;
    with expired as (select id from public.booking_notification_outbox where
        (completed_at<now()-interval '30 days' or prepared_at<now()-interval '30 days')
        and payloads_pruned_at is null and (status<>'processing' or lease_until<=now())
        order by coalesce(prepared_at,completed_at) for update skip locked limit p_limit),
    deleted as (delete from public.booking_notification_deliveries d using expired e where d.event_id=e.id)
    update public.booking_notification_outbox o set payloads_pruned_at=now(),
        status=case when o.status in ('pending','processing') then 'failed' else o.status end,
        completed_at=coalesce(o.completed_at,now()),lease_token=null,lease_until=null
        from expired e where o.id=e.id;
    get diagnostics v_count=row_count;
    return v_count;
end;
$$;

revoke all on function public.booking_notification_revision_guard(),public.booking_notification_enqueue_trigger(),
    public.enqueue_booking_notification(uuid,text),public.claim_booking_notifications(integer,integer),
    public.prepare_booking_notification_deliveries(uuid,uuid,jsonb),public.record_booking_notification_delivery(uuid,uuid,text,text),
    public.begin_booking_notification_delivery(uuid,uuid,text),public.fail_booking_notification_delivery(uuid,uuid,text,text,text),
    public.finish_booking_notification(uuid,uuid,text,text,integer),public.prune_booking_notifications(integer)
    from public,anon,authenticated;
grant execute on function public.enqueue_booking_notification(uuid,text),public.claim_booking_notifications(integer,integer),
    public.prepare_booking_notification_deliveries(uuid,uuid,jsonb),public.record_booking_notification_delivery(uuid,uuid,text,text),
    public.begin_booking_notification_delivery(uuid,uuid,text),public.fail_booking_notification_delivery(uuid,uuid,text,text,text),
    public.finish_booking_notification(uuid,uuid,text,text,integer),public.prune_booking_notifications(integer) to service_role;
commit;
