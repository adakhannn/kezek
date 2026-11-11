-- Reviewed against the actual schema, 2026-11-10. Maintenance and privileged
-- ownership operations are server commands, not public PostgREST entry points.
begin;

revoke all on function
 public.cleanup_old_api_metrics(integer),
 public.cleanup_old_finance_logs(integer),
 public.cleanup_old_funnel_events(integer),
 public.anonymize_old_bookings_pii(integer),
 public.anonymize_inactive_profiles_pii(integer),
 public.cleanup_expired_telegram_mobile_auth_attempts(integer),
 public.cleanup_expired_whatsapp_otp_codes(integer),
 public.cleanup_telegram_profile_links(),
 public.finalize_due_account_deletions(integer),
 public.purge_expired_holds(),
 public.log_finance_operation(uuid,uuid,text,text,text,uuid,date,jsonb,jsonb,jsonb,text,text,inet,text),
 public.log_api_metric(text,text,integer,integer,uuid,uuid,uuid,text,text,integer,integer,jsonb,inet,text),
 public.log_frontend_metric(text,jsonb,timestamptz,uuid,text,text,inet),
 public.force_delete_business_and_downgrade_owner(uuid),
 public.exec_grant_owner(uuid,uuid,uuid),
 public.clear_business_owner(uuid),
 public.purge_user(uuid)
 from public,anon,authenticated;
revoke insert,update,delete on table public.user_roles_legacy,public.user_roles_with_user,public.current_user_roles
 from public,anon,authenticated;

grant execute on function
 public.cleanup_old_api_metrics(integer),
 public.cleanup_old_finance_logs(integer),
 public.cleanup_old_funnel_events(integer),
 public.anonymize_old_bookings_pii(integer),
 public.anonymize_inactive_profiles_pii(integer),
 public.cleanup_expired_telegram_mobile_auth_attempts(integer),
 public.cleanup_expired_whatsapp_otp_codes(integer),
 public.cleanup_telegram_profile_links(),
 public.finalize_due_account_deletions(integer),
 public.purge_expired_holds(),
 public.log_finance_operation(uuid,uuid,text,text,text,uuid,date,jsonb,jsonb,jsonb,text,text,inet,text),
 public.log_api_metric(text,text,integer,integer,uuid,uuid,uuid,text,text,integer,integer,jsonb,inet,text),
 public.log_frontend_metric(text,jsonb,timestamptz,uuid,text,text,inet),
 public.force_delete_business_and_downgrade_owner(uuid),
 public.exec_grant_owner(uuid,uuid,uuid),
 public.clear_business_owner(uuid),
 public.purge_user(uuid)
 to service_role;

-- This developer shortcut is retired, including the service API surface.
revoke all on function public.dev_become_superadmin() from public,anon,authenticated,service_role;

-- Checked RPCs and server-side administrative handlers perform role writes.
-- Column-level grants are independent of table grants and must also be removed.
revoke insert,update,delete,truncate,references,trigger on table
 public.roles,public.user_roles,public.user_global_roles,public.super_admins_legacy,
 public.branch_admins,public.api_request_metrics,public.staff_finance_operation_logs,public.frontend_metrics
 from public,anon,authenticated;
do $$
declare v_table text; v_column text;
begin
 foreach v_table in array array['roles','user_roles','user_global_roles','super_admins_legacy',
  'branch_admins','api_request_metrics','staff_finance_operation_logs','frontend_metrics'] loop
  for v_column in select a.attname from pg_catalog.pg_attribute a
   where a.attrelid=pg_catalog.to_regclass('public.'||v_table) and a.attnum>0 and not a.attisdropped loop
   execute format('revoke insert(%I),update(%I),references(%I) on table public.%I from public,anon,authenticated',
    v_column,v_column,v_column,v_table);
  end loop;
 end loop;
end $$;

do $$
declare v_view text; v_column text;
begin
 foreach v_view in array array['user_roles_legacy','user_roles_with_user','current_user_roles'] loop
  for v_column in select a.attname from pg_catalog.pg_attribute a
   where a.attrelid=pg_catalog.to_regclass('public.'||v_view) and a.attnum>0 and not a.attisdropped loop
   execute format('revoke insert(%I),update(%I) on table public.%I from public,anon,authenticated',v_column,v_column,v_view);
  end loop;
 end loop;
end $$;

-- All three stores are issued by existing privileged application workflows.
-- The predicate always binds them to the caller; a tenant-scoped super_admin
-- row is never treated as a global platform role.
create or replace function public.is_super_admin()
returns boolean language sql stable security definer set search_path=pg_catalog,public as $$
 select auth.uid() is not null and (
  exists(select 1 from public.user_global_roles g join public.roles r on r.id=g.role_id
   where g.user_id=auth.uid() and r.scope='platform' and r.key='super_admin')
  or exists(select 1 from public.super_admins_legacy l where l.user_id=auth.uid())
  or exists(select 1 from public.user_roles u join public.roles r on r.id=u.role_id
   where u.user_id=auth.uid() and u.biz_id is null and r.key='super_admin')
 );
$$;

-- Current callers use the verified user's session. Permission is checked again
-- in SQL against the branch's actual business, including direct RPC requests.
create or replace function public.grant_branch_admin(p_branch_id uuid,p_user_id uuid)
returns void language plpgsql security definer set search_path=pg_catalog,public as $$
declare v_biz uuid; v_actor uuid:=auth.uid();
begin
 select biz_id into v_biz from public.branches where id=p_branch_id for update;
 if v_biz is null or p_user_id is null or v_actor is null or not (
  public.is_super_admin() or public.has_role('owner',v_biz) or public.has_role('admin',v_biz)
  or public.has_role('manager',v_biz)
  or exists(select 1 from public.businesses where id=v_biz and owner_id=v_actor)
 ) then raise exception using errcode='42501',message='BRANCH_ADMIN_FORBIDDEN'; end if;
 insert into public.branch_admins(branch_id,user_id) values(p_branch_id,p_user_id)
 on conflict(branch_id,user_id) do nothing;
end $$;
create or replace function public.revoke_branch_admin(p_branch_id uuid,p_user_id uuid)
returns void language plpgsql security definer set search_path=pg_catalog,public as $$
declare v_biz uuid; v_actor uuid:=auth.uid();
begin
 select biz_id into v_biz from public.branches where id=p_branch_id for update;
 if v_biz is null or p_user_id is null or v_actor is null or not (
  public.is_super_admin() or public.has_role('owner',v_biz) or public.has_role('admin',v_biz)
  or public.has_role('manager',v_biz)
  or exists(select 1 from public.businesses where id=v_biz and owner_id=v_actor)
 ) then raise exception using errcode='42501',message='BRANCH_ADMIN_FORBIDDEN'; end if;
 delete from public.branch_admins where branch_id=p_branch_id and user_id=p_user_id;
end $$;
revoke all on function public.grant_branch_admin(uuid,uuid),public.revoke_branch_admin(uuid,uuid) from public,anon;
grant execute on function public.grant_branch_admin(uuid,uuid),public.revoke_branch_admin(uuid,uuid) to authenticated;
commit;
