-- Durable signed WhatsApp inbox. Apply only after 123000 protects booking transitions.
-- Terminal rows retain a non-content deduplication tombstone; never replay legacy history.
begin;

do $$
begin
  if to_regprocedure('public._assert_booking_transition_access(uuid)') is null
    or to_regprocedure('public.cancel_booking(uuid)') is null
    or to_regprocedure('public.confirm_booking(uuid)') is null then
    raise exception 'INBOX_REQUIRES_PROTECTED_BOOKING_COMMANDS';
  end if;
  if has_function_privilege('anon','public.cancel_booking(uuid)','EXECUTE')
    or has_function_privilege('anon','public.confirm_booking(uuid)','EXECUTE') then
    raise exception 'INBOX_REQUIRES_PROTECTED_BOOKING_COMMANDS';
  end if;
end;
$$;

create table public.whatsapp_inbox (
  id uuid primary key default gen_random_uuid(),
  receiver text not null check (receiver ~ '^[0-9]{1,32}$'),
  message_id text not null check (length(message_id) between 1 and 512),
  payload_hash text not null check (payload_hash ~ '^[a-f0-9]{64}$'),
  provider_timestamp timestamptz not null,
  sender text check (sender ~ '^\+[0-9]{7,15}$'),
  message_type text,
  message_text text,
  command text check (command in ('confirm','cancel','remind','help','booking_info','media')),
  booking_number integer,
  status text not null default 'pending' check (status in ('pending','processing','sent','failed','ambiguous','legacy_manual','expired')),
  attempts integer not null default 0 check (attempts between 0 and 8),
  available_at timestamptz not null default clock_timestamp(),
  lease_token uuid,
  lease_until timestamptz,
  command_receipt jsonb,
  reply_payload jsonb,
  reply_started_at timestamptz,
  provider_reply_id text,
  last_error_code text,
  created_at timestamptz not null default clock_timestamp(),
  completed_at timestamptz,
  pruned_at timestamptz,
  unique(receiver,message_id)
);
create index whatsapp_inbox_pending on public.whatsapp_inbox(receiver,available_at,created_at)
  where status in ('pending','processing');
create index whatsapp_inbox_retention on public.whatsapp_inbox(completed_at) where pruned_at is null;
create index whatsapp_inbox_health on public.whatsapp_inbox(status,available_at,lease_until) where status<>'sent';
alter table public.whatsapp_inbox enable row level security;
revoke all on public.whatsapp_inbox from public,anon,authenticated,service_role;
grant select on public.whatsapp_inbox to service_role;

create function public._require_whatsapp_inbox_service() returns void
language plpgsql security definer set search_path=pg_catalog,public as $$
begin
  if coalesce(nullif(current_setting('role',true),'none'),session_user) not in ('service_role','postgres','supabase_admin') then
    raise exception using errcode='42501',message='INBOX_SERVICE_ONLY';
  end if;
end;
$$;

create function public.receive_whatsapp_inbox(p_receiver text,p_messages jsonb) returns integer
language plpgsql security definer set search_path=pg_catalog,public set statement_timeout='4s' as $$
declare m jsonb; existing public.whatsapp_inbox; inserted_count integer:=0; legacy boolean; stamp timestamptz;
begin
  perform public._require_whatsapp_inbox_service();
  if p_receiver is null or p_receiver !~ '^[0-9]{1,32}$' or p_messages is null
     or jsonb_typeof(p_messages)<>'array' or jsonb_array_length(p_messages)>100 or octet_length(p_messages::text)>524288 then
    raise exception 'INBOX_INVALID_INPUT';
  end if;
  for m in select value from jsonb_array_elements(p_messages) loop
    if jsonb_typeof(m)<>'object' or m->>'receiver' is distinct from p_receiver
      or coalesce(length(m->>'message_id'),0) not between 1 and 512
      or coalesce(m->>'sender','') !~ '^\+[0-9]{7,15}$'
      or coalesce(m->>'payload_hash','') !~ '^[a-f0-9]{64}$'
      or coalesce(m->>'message_type','') !~ '^[a-z_]{1,32}$'
      or m->>'text' is null or length(m->>'text')>4096
      or coalesce(m->>'command','') not in ('confirm','cancel','remind','help','booking_info','media')
      or m->>'provider_timestamp' is null
      or (m->>'booking_number' is not null and (m->>'booking_number') !~ '^[0-9]{1,6}$') then
      raise exception 'INBOX_INVALID_INPUT';
    end if;
    stamp:=(m->>'provider_timestamp')::timestamptz;
    if not isfinite(stamp) or stamp>clock_timestamp()+interval '5 minutes' then raise exception 'INBOX_INVALID_INPUT'; end if;
    -- Pre-existing rows may already have performed a command or sent a reply even when processed=false.
    select exists(select 1 from public.whatsapp_messages where whatsapp_message_id=m->>'message_id') into legacy;
    insert into public.whatsapp_inbox(receiver,message_id,payload_hash,provider_timestamp,sender,message_type,message_text,command,booking_number,status,completed_at,last_error_code)
    values(p_receiver,m->>'message_id',m->>'payload_hash',stamp,m->>'sender',m->>'message_type',m->>'text',m->>'command',(m->>'booking_number')::integer,
      case when legacy then 'legacy_manual' when stamp<clock_timestamp()-interval '24 hours' then 'expired' else 'pending' end,
      case when legacy or stamp<clock_timestamp()-interval '24 hours' then clock_timestamp() end,
      case when legacy then 'legacy_outcome_unknown' when stamp<clock_timestamp()-interval '24 hours' then 'message_expired' end)
    on conflict(receiver,message_id) do nothing;
    if found then inserted_count:=inserted_count+1; end if;
    select * into strict existing from public.whatsapp_inbox where receiver=p_receiver and message_id=m->>'message_id';
    if existing.payload_hash is distinct from m->>'payload_hash' or existing.provider_timestamp is distinct from stamp then
      raise exception 'INBOX_PAYLOAD_CONFLICT';
    end if;
  end loop;
  return inserted_count;
end;
$$;

create function public.claim_whatsapp_inbox(p_receiver text,p_limit integer default 4)
returns table(id uuid,lease_token uuid,attempts integer)
language plpgsql security definer set search_path=pg_catalog,public set statement_timeout='4s' as $$
begin
  perform public._require_whatsapp_inbox_service();
  if p_receiver is null or p_receiver !~ '^[0-9]{1,32}$' or p_limit is null or p_limit not between 1 and 4 then raise exception 'INBOX_INVALID_INPUT'; end if;
  -- Bounded maintenance also recovers a crashed final attempt and uncertain send.
  with stale as (
    select i.id from public.whatsapp_inbox i where i.receiver=p_receiver and i.status in ('pending','processing')
      and (i.status='pending' or i.lease_until<=clock_timestamp())
      and (i.reply_started_at is not null or i.attempts>=8 or i.provider_timestamp<clock_timestamp()-interval '24 hours'
        or (i.command_receipt is null and exists(select 1 from public.whatsapp_messages m where m.whatsapp_message_id=i.message_id)))
    order by i.created_at for update skip locked limit 100
  ) update public.whatsapp_inbox i set
      status=case when i.reply_started_at is not null then 'ambiguous' when i.command_receipt is null and exists(select 1 from public.whatsapp_messages m where m.whatsapp_message_id=i.message_id) then 'legacy_manual' when i.attempts>=8 then 'failed' else 'expired' end,
      last_error_code=case when i.reply_started_at is not null then 'reply_outcome_unknown' when i.command_receipt is null and exists(select 1 from public.whatsapp_messages m where m.whatsapp_message_id=i.message_id) then 'legacy_outcome_unknown' when i.attempts>=8 then 'attempts_exhausted' else 'message_expired' end,
      completed_at=clock_timestamp(),lease_token=null,lease_until=null
    from stale where i.id=stale.id;
  return query with candidates as (
    select i.id from public.whatsapp_inbox i where i.receiver=p_receiver and i.status in ('pending','processing')
      and (i.status='pending' or i.lease_until<=clock_timestamp()) and i.available_at<=clock_timestamp()
      and i.attempts<8 and i.reply_started_at is null and i.provider_timestamp>=clock_timestamp()-interval '24 hours'
      and (i.command_receipt is not null or not exists(select 1 from public.whatsapp_messages m where m.whatsapp_message_id=i.message_id))
    order by i.created_at,i.id for update skip locked limit p_limit
  ) update public.whatsapp_inbox i set status='processing',attempts=i.attempts+1,lease_token=gen_random_uuid(),lease_until=clock_timestamp()+interval '90 seconds'
    from candidates where i.id=candidates.id returning i.id,i.lease_token,i.attempts;
end;
$$;

create function public._locked_whatsapp_inbox(p_id uuid,p_token uuid) returns public.whatsapp_inbox
language plpgsql security definer set search_path=pg_catalog,public as $$
declare item public.whatsapp_inbox;
begin
  perform public._require_whatsapp_inbox_service();
  select * into item from public.whatsapp_inbox where id=p_id for update;
  if not found or item.status<>'processing' or item.lease_token is distinct from p_token or item.lease_until<=clock_timestamp() then
    raise exception 'INBOX_LEASE_LOST';
  end if;
  return item;
end;
$$;

create function public.process_whatsapp_inbox(p_id uuid,p_token uuid,p_receiver text) returns jsonb
language plpgsql security definer set search_path=pg_catalog,public set statement_timeout='4s' set lock_timeout='3s' as $$
declare
  item public.whatsapp_inbox; profile_id uuid; profile_count integer; booking_ids uuid[];
  target public.bookings; target_staff uuid; booking_id uuid; booking_count integer; reply text; list_text text; outcome text;
begin
  item:=public._locked_whatsapp_inbox(p_id,p_token);
  if item.receiver is distinct from p_receiver then raise exception 'INBOX_INVALID_INPUT'; end if;
  if item.reply_payload is not null then return jsonb_build_object('outcome',item.command_receipt->>'outcome','payload',item.reply_payload); end if;
  if exists(select 1 from public.whatsapp_messages where whatsapp_message_id=item.message_id) then raise exception 'INBOX_LEGACY_OUTCOME_UNKNOWN'; end if;
  if item.provider_timestamp<clock_timestamp()-interval '24 hours' then raise exception 'INBOX_MESSAGE_EXPIRED'; end if;
  -- Lock matching profiles while establishing ownership; ambiguous duplicate phone records cannot select an identity.
  select count(*), (array_agg(p.id))[1] into profile_count,profile_id
    from (select id from public.profiles where phone=item.sender for share) p;
  if profile_count>1 then
    outcome:='identity_ambiguous'; reply:='Не удалось однозначно определить профиль. Откройте запись на сайте или обратитесь к администратору.';
  elsif item.command='media' then
    outcome:='media_ack'; reply:='Сообщение получено. Для управления записью отправьте текст: помощь, напомни, подтвердить или отмена.';
  elsif item.command='help' then
    outcome:='help'; reply:=E'Команды: «напомни» — записи; «подтвердить 1» — подтвердить; «отмена 1» — отменить; «помощь». Номер выбирается из текущего списка записей.';
  else
    -- Match the signed sender to the current profile phone; phone-only fallback is restricted to actual guest rows.
    select array_agg(b.id order by b.start_at,b.id) into booking_ids from (
      select b.id,b.start_at from public.bookings b
      where ((profile_id is not null and b.client_id=profile_id) or (profile_id is null and b.client_id is null and b.client_phone=item.sender))
        and b.status::text in ('hold','confirmed','paid') and b.start_at>=clock_timestamp()
      order by b.start_at,b.id limit 10
    ) b;
    booking_count:=coalesce(array_length(booking_ids,1),0);
    select string_agg(format('%s. %s (%s) — %s; %s; %s; %s',
      array_position(booking_ids,b.id),to_char(b.start_at at time zone coalesce(to_jsonb(biz)->>'tz','Asia/Bishkek'),'DD.MM.YYYY HH24:MI'),
      coalesce(to_jsonb(biz)->>'tz','Asia/Bishkek'),
      left(coalesce(to_jsonb(s)->>'name_ru','услуга'),60),left(coalesce(to_jsonb(st)->>'full_name','мастер'),60),
      left(coalesce(to_jsonb(br)->>'name','филиал'),60),left(coalesce(to_jsonb(br)->>'address',''),80)),E'\n' order by array_position(booking_ids,b.id))
      into list_text from public.bookings b
      left join public.businesses biz on biz.id=b.biz_id left join public.services s on s.id=b.service_id
      left join public.staff st on st.id=b.staff_id left join public.branches br on br.id=b.branch_id
      where b.id=any(booking_ids);
    if booking_count=0 then
      outcome:='no_active_bookings'; reply:='Активных предстоящих записей не найдено. Проверьте запись на сайте.';
    elsif item.command in ('remind','booking_info') then
      outcome:='booking_list'; reply:=E'Ваши ближайшие записи (не более 10):\n'||list_text||E'\nКоманды: «подтвердить 1», «отмена 1», «помощь».';
    elsif (item.booking_number is null and booking_count>1) or (item.booking_number is not null and item.booking_number not between 1 and booking_count) then
      outcome:='booking_choice_required'; reply:=E'Укажите номер из текущего списка:\n'||list_text||E'\nНапример: «подтвердить 1» или «отмена 1».';
    else
      booking_id:=booking_ids[coalesce(item.booking_number,1)];
      -- Booking/finance commands use staff -> booking lock order. Never invert it here.
      select staff_id into target_staff from public.bookings where id=booking_id;
      perform 1 from public.staff where id=target_staff for update;
      select * into target from public.bookings where id=booking_id for update;
      -- Recheck after acquiring the booking row lock: selection was a snapshot, not authorization.
      if not found or target.staff_id is distinct from target_staff or target.start_at<clock_timestamp() or target.status::text not in ('hold','confirmed','paid')
        or not ((profile_id is not null and target.client_id=profile_id) or
          (profile_id is null and target.client_id is null and target.client_phone=item.sender)) then
        outcome:='booking_changed'; reply:='Запись изменилась. Запросите список командой «напомни» и проверьте запись на сайте.';
      elsif item.command='confirm' and target.status::text in ('confirmed','paid') then
        outcome:='already_confirmed'; reply:='Запись уже подтверждена.';
      elsif item.command='cancel' and target.status::text='paid' then
        outcome:='paid_requires_review'; reply:='Для отмены оплаченной записи и проверки возврата обратитесь к администратору.';
      else
        if item.command='confirm' then
          perform public.confirm_booking(booking_id);
          if not exists(select 1 from public.bookings where id=booking_id and status::text in ('confirmed','paid')) then raise exception 'INBOX_TRANSITION_FAILED'; end if;
          outcome:='confirmed'; reply:='Запись подтверждена.';
        elsif item.command='cancel' then
          begin
            perform public.cancel_booking(booking_id);
            if not exists(select 1 from public.bookings where id=booking_id and status::text='cancelled') then raise exception 'INBOX_TRANSITION_FAILED'; end if;
            outcome:='cancelled'; reply:='Запись отменена.';
          exception when raise_exception then
            if sqlerrm='BOOKING_FINANCIAL_REVERSAL_REQUIRED' then
              outcome:='financial_reversal_required'; reply:='Для отмены этой записи требуется финансовая сверка. Обратитесь к администратору.';
            else raise; end if;
          end;
        else raise exception 'INBOX_INVALID_INPUT'; end if;
      end if;
    end if;
  end if;
  -- Booking transition, its notification trigger, and immutable command/reply receipt share one commit.
  update public.whatsapp_inbox set command_receipt=jsonb_build_object('outcome',outcome,'booking_id',booking_id,'completed_at',clock_timestamp()),
    reply_payload=jsonb_build_object('messaging_product','whatsapp','recipient_type','individual','to',substring(item.sender from 2),'type','text','text',jsonb_build_object('body',reply))
    where id=p_id returning * into item;
  return jsonb_build_object('outcome',outcome,'payload',item.reply_payload);
end;
$$;

create function public.begin_whatsapp_inbox_reply(p_id uuid,p_token uuid) returns void
language plpgsql security definer set search_path=pg_catalog,public set statement_timeout='4s' as $$
declare item public.whatsapp_inbox;
begin
  item:=public._locked_whatsapp_inbox(p_id,p_token);
  if item.reply_payload is null or item.reply_started_at is not null then raise exception 'INBOX_REPLY_NOT_SENDABLE'; end if;
  if item.provider_timestamp<clock_timestamp()-interval '24 hours' then raise exception 'INBOX_MESSAGE_EXPIRED'; end if;
  update public.whatsapp_inbox set reply_started_at=clock_timestamp() where id=p_id;
end;
$$;

create function public.record_whatsapp_inbox_reply(p_id uuid,p_token uuid,p_provider_id text) returns void
language plpgsql security definer set search_path=pg_catalog,public set statement_timeout='4s' as $$
declare item public.whatsapp_inbox;
begin
  item:=public._locked_whatsapp_inbox(p_id,p_token);
  if item.reply_started_at is null or p_provider_id is null or length(p_provider_id) not between 1 and 512 then raise exception 'INBOX_INVALID_INPUT'; end if;
  update public.whatsapp_inbox set status='sent',provider_reply_id=p_provider_id,completed_at=clock_timestamp(),lease_token=null,lease_until=null,last_error_code=null where id=p_id;
end;
$$;

create function public.fail_whatsapp_inbox(p_id uuid,p_token uuid,p_outcome text,p_code text,p_retry_after integer default 0) returns void
language plpgsql security definer set search_path=pg_catalog,public set statement_timeout='4s' as $$
declare item public.whatsapp_inbox; terminal boolean;
begin
  item:=public._locked_whatsapp_inbox(p_id,p_token);
  if p_outcome is null or p_outcome not in ('retry','failed','ambiguous') or p_code is null or p_code !~ '^[a-z_0-9]{1,80}$'
    or p_retry_after is null or p_retry_after not between 0 and 3600 then raise exception 'INBOX_INVALID_INPUT'; end if;
  -- After begin, only a known rejection / pre-send configuration failure permits another send.
  if item.reply_started_at is not null and p_outcome='retry' and p_code not in ('provider_rate_limited','provider_config_missing') then raise exception 'INBOX_UNSAFE_RETRY'; end if;
  terminal:=p_outcome<>'retry' or item.attempts>=8;
  update public.whatsapp_inbox set status=case when p_outcome='ambiguous' then 'ambiguous' when terminal then 'failed' else 'pending' end,
    reply_started_at=case when not terminal then null else reply_started_at end,
    last_error_code=case when p_outcome='retry' and terminal then 'attempts_exhausted' else p_code end,
    completed_at=case when terminal then clock_timestamp() end,lease_token=null,lease_until=null,
    available_at=clock_timestamp()+make_interval(secs=>greatest(p_retry_after,least(3600,15*(2^item.attempts)::integer))) where id=p_id;
end;
$$;

create function public.release_whatsapp_inbox(p_id uuid,p_token uuid) returns void
language plpgsql security definer set search_path=pg_catalog,public set statement_timeout='4s' as $$
declare item public.whatsapp_inbox;
begin
  item:=public._locked_whatsapp_inbox(p_id,p_token);
  if item.reply_started_at is not null then raise exception 'INBOX_UNSAFE_RETRY'; end if;
  update public.whatsapp_inbox set status='pending',attempts=attempts-1,lease_token=null,lease_until=null where id=p_id;
end;
$$;

create function public.prune_whatsapp_inbox(p_limit integer default 100) returns integer
language plpgsql security definer set search_path=pg_catalog,public set statement_timeout='4s' as $$
declare affected integer;
begin
  perform public._require_whatsapp_inbox_service();
  if p_limit is null or p_limit not between 1 and 100 then raise exception 'INBOX_INVALID_INPUT'; end if;
  with old as (select id from public.whatsapp_inbox where pruned_at is null and (
      completed_at<clock_timestamp()-interval '30 days' or
      (created_at<clock_timestamp()-interval '30 days' and status in ('pending','processing') and (lease_until is null or lease_until<=clock_timestamp())))
    order by created_at for update skip locked limit p_limit)
  update public.whatsapp_inbox i set sender=null,message_type=null,message_text=null,command=null,booking_number=null,
    command_receipt=null,reply_payload=null,provider_reply_id=null,pruned_at=clock_timestamp(),
    status=case when i.status in ('pending','processing') then case when reply_started_at is not null then 'ambiguous' else 'expired' end else i.status end,
    last_error_code=case when i.status in ('pending','processing') then case when reply_started_at is not null then 'reply_outcome_unknown' else 'message_expired' end else i.last_error_code end,
    completed_at=coalesce(i.completed_at,clock_timestamp()),lease_token=null,lease_until=null
    from old where i.id=old.id;
  get diagnostics affected=row_count;
  return affected;
end;
$$;

create function public.whatsapp_inbox_backlog_health() returns jsonb
language plpgsql security definer set search_path=pg_catalog,public set statement_timeout='4s' as $$
declare result jsonb; observed_at timestamptz:=clock_timestamp();
begin
  perform public._require_whatsapp_inbox_service();
  with states as (
    select i.*, (i.command_receipt is null and exists(select 1 from public.whatsapp_messages m where m.whatsapp_message_id=i.message_id)) as legacy
    from public.whatsapp_inbox i where i.status<>'sent'
  ), flags as (
    select *,
      status in ('pending','processing') and (status='pending' or lease_until<=observed_at)
        and available_at<=observed_at and attempts<8 and reply_started_at is null
        and provider_timestamp>=observed_at-interval '24 hours' and not legacy as due,
      status='ambiguous' or (status='processing' and lease_until<=observed_at and reply_started_at is not null) as uncertain,
      status in ('failed','ambiguous','legacy_manual','expired') or (status in ('pending','processing') and (status='pending' or lease_until<=observed_at)
        and (attempts>=8 or provider_timestamp<observed_at-interval '24 hours' or legacy or reply_started_at is not null)) as attention
    from states
  ) select jsonb_build_object(
      'pending',count(*) filter(where status='pending'),
      'due',count(*) filter(where due),
      'processing',count(*) filter(where status='processing'),
      'failed',count(*) filter(where attention),
      'ambiguous',count(*) filter(where uncertain),
      'oldest_due_age_seconds',coalesce(greatest(0,extract(epoch from observed_at-min(case when status='processing' then greatest(available_at,lease_until) else available_at end) filter(where due))),0)
    ) into result from flags;
  return result;
end;
$$;

revoke all on function public._require_whatsapp_inbox_service(),public._locked_whatsapp_inbox(uuid,uuid),
  public.receive_whatsapp_inbox(text,jsonb),public.claim_whatsapp_inbox(text,integer),public.process_whatsapp_inbox(uuid,uuid,text),
  public.begin_whatsapp_inbox_reply(uuid,uuid),public.record_whatsapp_inbox_reply(uuid,uuid,text),
  public.fail_whatsapp_inbox(uuid,uuid,text,text,integer),public.release_whatsapp_inbox(uuid,uuid),public.prune_whatsapp_inbox(integer),public.whatsapp_inbox_backlog_health()
  from public,anon,authenticated,service_role;
grant execute on function public.receive_whatsapp_inbox(text,jsonb),public.claim_whatsapp_inbox(text,integer),public.process_whatsapp_inbox(uuid,uuid,text),
  public.begin_whatsapp_inbox_reply(uuid,uuid),public.record_whatsapp_inbox_reply(uuid,uuid,text),
  public.fail_whatsapp_inbox(uuid,uuid,text,text,integer),public.release_whatsapp_inbox(uuid,uuid),public.prune_whatsapp_inbox(integer),public.whatsapp_inbox_backlog_health()
  to service_role;
commit;
