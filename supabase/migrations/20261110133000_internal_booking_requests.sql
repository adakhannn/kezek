-- Internal creation shares durable receipts but binds staff actor separately
-- from the booking's client. HTTP verifies actor; browser cannot invoke RPC.
begin;
create function public._internal_booking_actor_allowed(p_actor uuid,p_biz uuid,p_branch uuid,p_staff uuid)
returns boolean language sql stable security definer set search_path=public,pg_temp as $$
  select p_actor is not null and (
    public.finance_can_manage_business(p_actor,p_biz)
    or exists(select 1 from public.branch_admins ba join public.branches b on b.id=ba.branch_id
      where ba.user_id=p_actor and b.id=p_branch and b.biz_id=p_biz)
    or exists(select 1 from public.staff where id=p_staff and biz_id=p_biz and user_id=p_actor and is_active)
    or exists(select 1 from public.user_global_roles u join public.roles r on r.id=u.role_id
      where u.user_id=p_actor and r.scope='platform' and r.key='super_admin')
    or exists(select 1 from public.user_roles u join public.roles r on r.id=u.role_id
      where u.user_id=p_actor and u.biz_id is null and r.key='super_admin')
    or exists(select 1 from public.super_admins_legacy where user_id=p_actor));
$$;
revoke all on function public._internal_booking_actor_allowed(uuid,uuid,uuid,uuid) from public,anon,authenticated,service_role;

create function public.create_internal_booking_request(p_request_id uuid,p_payload jsonb,p_actor_id uuid)
returns jsonb language plpgsql security definer set search_path=public,pg_temp set lock_timeout='5s' as $$
declare
  v_biz uuid; v_branch uuid; v_staff uuid; v_service uuid; v_client uuid; v_start timestamptz;
  v_mode text; v_minutes integer; v_services jsonb; v_payload jsonb;
  v_caller_hash text; v_payload_hash text; v_receipt public.booking_creation_requests;
  v_booking uuid; v_response jsonb;
begin
  if p_actor_id is null then raise exception using errcode='42501',message='BOOKING_AUTH_REQUIRED'; end if;
  if p_request_id is null or p_payload is null or jsonb_typeof(p_payload)<>'object' or octet_length(p_payload::text)>32768 then
    raise exception using errcode='22023',message='INVALID_BOOKING_REQUEST';
  end if;
  v_biz:=(p_payload->>'biz_id')::uuid;v_branch:=(p_payload->>'branch_id')::uuid;v_staff:=(p_payload->>'staff_id')::uuid;
  v_client:=(p_payload->>'client_id')::uuid;v_start:=(p_payload->>'start_at')::timestamptz;v_mode:=p_payload->>'mode';
  if v_biz is null or v_branch is null or v_staff is null or v_start is null or not isfinite(v_start)
    or v_mode is null or v_mode not in ('simple','complex') then
    raise exception using errcode='22023',message='INVALID_BOOKING_REQUEST';
  end if;
  if not public._internal_booking_actor_allowed(p_actor_id,v_biz,v_branch,v_staff) then
    raise exception using errcode='42501',message='BOOKING_FORBIDDEN';
  end if;
  if length(coalesce(p_payload->>'client_name',''))>100 or length(coalesce(p_payload->>'client_phone',''))>32
    or length(coalesce(p_payload->>'client_email',''))>254 then raise exception 'INVALID_BOOKING_REQUEST'; end if;
  if v_mode='simple' then
    v_service:=(p_payload->>'service_id')::uuid;v_minutes:=(p_payload->>'duration_min')::integer;
    if v_service is null or v_minutes is null or v_minutes not between 1 and 1440 then raise exception 'INVALID_BOOKING_REQUEST'; end if;
  else
    v_services:=p_payload->'services';
    if v_services is null or jsonb_typeof(v_services)<>'array' or jsonb_array_length(v_services) not between 1 and 20 then raise exception 'INVALID_BOOKING_REQUEST'; end if;
    select jsonb_agg(jsonb_build_object('service_id',(s.value->>'service_id')::uuid,'duration_min',(s.value->>'duration_min')::integer,
      'order_index',coalesce((s.value->>'order_index')::integer,s.ordinality::integer-1)) order by s.ordinality)
      into v_services from jsonb_array_elements(v_services) with ordinality s;
  end if;
  v_payload:=jsonb_build_object('kind','internal','mode',v_mode,'biz_id',v_biz,'branch_id',v_branch,'staff_id',v_staff,
    'start_at',extract(epoch from v_start),'service_id',v_service,'duration_min',v_minutes,'services',v_services,'client_id',v_client,
    'client_name',nullif(trim(p_payload->>'client_name'),''),'client_phone',nullif(trim(p_payload->>'client_phone'),''),'client_email',nullif(trim(p_payload->>'client_email'),''));
  v_caller_hash:=encode(sha256(convert_to('internal:'||p_actor_id::text,'UTF8')),'hex');
  v_payload_hash:=encode(sha256(convert_to(v_payload::text,'UTF8')),'hex');
  insert into public.booking_creation_requests(request_id,caller_hash,payload_hash) values(p_request_id,v_caller_hash,v_payload_hash)
    on conflict(request_id) do nothing;
  select * into strict v_receipt from public.booking_creation_requests where request_id=p_request_id for update;
  if v_receipt.caller_hash<>v_caller_hash or v_receipt.payload_hash<>v_payload_hash then raise exception 'BOOKING_REQUEST_CONFLICT'; end if;
  if v_receipt.response is not null then return v_receipt.response; end if;
  -- The checked legacy implementation owns entity/schedule/overlap validation
  -- and staff locking. Only its owner may call it after this migration.
  if v_mode='simple' then
    v_booking:=public.create_internal_booking(v_biz,v_branch,v_service,v_staff,v_start,v_minutes,v_client,
      v_payload->>'client_name',v_payload->>'client_phone');
  else
    v_booking:=public.create_internal_complex_booking(v_biz,v_branch,v_staff,v_start,v_services,v_client,
      v_payload->>'client_name',v_payload->>'client_phone',v_payload->>'client_email');
  end if;
  v_response:=jsonb_build_object('booking_id',v_booking,'confirmed',true);
  update public.booking_creation_requests set booking_id=v_booking,response=v_response where request_id=p_request_id;
  return v_response;
end;
$$;
revoke all on function public.create_internal_booking(uuid,uuid,uuid,uuid,timestamptz,integer,uuid,text,text),
 public.create_internal_complex_booking(uuid,uuid,uuid,timestamptz,jsonb,uuid,text,text,text)
 from public,anon,authenticated,service_role;
revoke all on function public.create_internal_booking_request(uuid,jsonb,uuid) from public,anon,authenticated;
grant execute on function public.create_internal_booking_request(uuid,jsonb,uuid) to service_role;
commit;
