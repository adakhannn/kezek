-- MANUAL / DESTRUCTIVE / PRODUCTION
--
-- Target Supabase project: beulnmftzbmtbdlgurht
-- Preserved Auth user: 125e60ab-eb79-4d92-bc6d-d84ae534eeee
--
-- Run only in Supabase Dashboard -> SQL Editor after checking the project ref.
-- The whole database cleanup runs in one transaction. Any SQL error rolls it back.
-- Storage files are intentionally NOT deleted through SQL; see the final instructions.

begin;

set local lock_timeout = '10s';
set local statement_timeout = '5min';

-- Refuse to run unless the expected Auth user and the single platform super-admin
-- assignment are present. This protects against running the script in another project.
do $$
declare
    keep_user constant uuid := '125e60ab-eb79-4d92-bc6d-d84ae534eeee';
    super_role_id uuid;
    super_admin_count integer;
begin
    if not exists (select 1 from auth.users where id = keep_user) then
        raise exception 'RESET ABORTED: preserved Auth user % does not exist', keep_user;
    end if;

    select id
      into super_role_id
      from public.roles
     where key = 'super_admin'
       and is_system is true
       and scope = 'platform';

    if super_role_id is null then
        raise exception 'RESET ABORTED: system platform role super_admin does not exist';
    end if;

    select count(distinct ur.user_id)
      into super_admin_count
      from public.user_roles ur
     where ur.role_id = super_role_id
       and ur.biz_id is null;

    if super_admin_count <> 1 then
        raise exception 'RESET ABORTED: expected exactly one platform super-admin, found %', super_admin_count;
    end if;

    if not exists (
        select 1
          from public.user_roles ur
         where ur.user_id = keep_user
           and ur.role_id = super_role_id
           and ur.biz_id is null
    ) then
        raise exception 'RESET ABORTED: preserved user is not the sole platform super-admin';
    end if;
end
$$;

-- Application moderation and account lifecycle.
delete from public.application_moderation_actions;
delete from public.application_submission_blocks;
delete from public.account_deletion_requests;

-- Booking, review, promotion and visit-package details.
delete from public.booking_services;
delete from public.client_visit_package_uses;
delete from public.client_promotion_usage;
delete from public.client_referrals;
delete from public.reviews;

-- Shift and finance details must be removed before their parent rows.
delete from public.staff_shift_items;
delete from public.staff_shift_expenses;
delete from public.staff_finance_operation_logs;
delete from public.finance_settings_audit_log;
delete from public.staff_shift_aggregates;
delete from public.staff_shifts;

-- Calculated and historical business metrics.
delete from public.staff_day_metrics;
delete from public.branch_day_metrics;
delete from public.biz_day_metrics;
delete from public.business_daily_stats;
delete from public.business_hourly_load;
delete from public.rating_manual_recalc_log;
delete from public.rating_recalc_errors;
delete from public.rating_jobs;
delete from public.rating_biz_config;

-- Staff, service and schedule relationships.
delete from public.service_staff;
delete from public.staff_branch_assignments;
delete from public.staff_schedule_rules;
delete from public.staff_time_off;
delete from public.working_hours;
delete from public.branch_working_hours;
delete from public.branch_admins;

-- Packages, promotions and outbound messages.
delete from public.client_visit_packages;
delete from public.visit_package_plans;
delete from public.branch_promotions;
delete from public.whatsapp_messages;

-- Main business entities.
delete from public.bookings;
delete from public.services;
delete from public.staff;
delete from public.branches;
delete from public.business_role_applications;
delete from public.business_registration_applications;

-- Remove every business-scoped role, including old owner roles of the preserved user.
-- Keep exactly one global platform super-admin assignment.
delete from public.user_roles ur
where not (
    ur.user_id = '125e60ab-eb79-4d92-bc6d-d84ae534eeee'::uuid
    and ur.biz_id is null
    and ur.role_id = (select id from public.roles where key = 'super_admin' and is_system is true and scope = 'platform')
);

delete from public.user_global_roles ugr
where not (
    ugr.user_id = '125e60ab-eb79-4d92-bc6d-d84ae534eeee'::uuid
    and ugr.role_id = (select id from public.roles where key = 'super_admin' and is_system is true and scope = 'platform')
);

delete from public.user_current_business;
delete from public.user_suspensions;

-- Logs and short-lived operational data.
delete from public.analytics_events;
delete from public.api_request_metrics;
delete from public.frontend_metrics;
delete from public.telegram_auth_audit_log;
delete from public.telegram_mobile_auth_attempts;
delete from public.whatsapp_otp_codes;

-- The parent table is removed after every known dependent table.
delete from public.businesses;

-- Preserve only the selected super-admin profile and Auth account.
delete from public.profiles
where id <> '125e60ab-eb79-4d92-bc6d-d84ae534eeee'::uuid;

delete from auth.users
where id <> '125e60ab-eb79-4d92-bc6d-d84ae534eeee'::uuid;

-- Remove non-system roles accidentally created during testing.
delete from public.roles where is_system is not true;

-- Hard assertions: an unexpected residual row aborts and rolls back everything.
do $$
declare
    keep_user constant uuid := '125e60ab-eb79-4d92-bc6d-d84ae534eeee';
begin
    if (select count(*) from auth.users) <> 1 then
        raise exception 'RESET ABORTED: expected one Auth user after cleanup';
    end if;
    if not exists (select 1 from auth.users where id = keep_user) then
        raise exception 'RESET ABORTED: preserved Auth user disappeared';
    end if;
    if (select count(*) from public.businesses) <> 0
       or (select count(*) from public.branches) <> 0
       or (select count(*) from public.staff) <> 0
       or (select count(*) from public.bookings) <> 0
       or (select count(*) from public.business_registration_applications) <> 0
       or (select count(*) from public.business_role_applications) <> 0 then
        raise exception 'RESET ABORTED: core test data remains';
    end if;
    if (
        select count(*)
          from public.user_roles ur
          join public.roles r on r.id = ur.role_id
         where ur.user_id = keep_user
           and ur.biz_id is null
           and r.key = 'super_admin'
           and r.is_system is true
           and r.scope = 'platform'
    ) <> 1 then
        raise exception 'RESET ABORTED: preserved platform super-admin assignment is invalid';
    end if;
    if exists (select 1 from public.roles where is_system is not true) then
        raise exception 'RESET ABORTED: non-system test roles remain';
    end if;
end
$$;

commit;

-- Verification output. Every data count must be 0; auth_users must be 1.
select
    (select count(*) from auth.users) as auth_users,
    (select count(*) from public.businesses) as businesses,
    (select count(*) from public.branches) as branches,
    (select count(*) from public.staff) as staff,
    (select count(*) from public.bookings) as bookings,
    (select count(*) from public.business_registration_applications) as business_applications,
    (select count(*) from public.business_role_applications) as role_applications,
    (select count(*) from public.roles where is_system is true) as system_roles,
    (select count(*) from public.categories) as categories,
    (select count(*) from public.rating_global_config) as rating_global_config;

-- Storage cleanup (after this transaction succeeds):
-- Supabase Dashboard -> Storage -> avatars -> select all objects -> Delete.
-- Do not delete rows directly from storage.objects: that can leave orphaned files
-- in the backing object store. Keep the avatars bucket itself.
