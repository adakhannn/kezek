-- Rows of one business could point at another business's staff, branches and services
-- (17 Nov review, docs/PROJECT_REVIEW_2026-11-17.md DB-08). The schema has single-column
-- foreign keys only, and the write policies of managers check the row's own biz_id, not what it
-- references. A manager of any business (a registered owner is one) could therefore, e.g.:
--   * insert staff_schedule_rules / working_hours rows with their own biz_id for a competitor's
--     master; schedule_effective_day reads the legacy rules by staff_id alone, so the competitor
--     lost or changed that master's working day and slots;
--   * insert staff_branch_assignments for a foreign master or branch, attach branch_promotions
--     or branch_working_hours to a foreign branch, or link service_staff across businesses.
-- Composite foreign keys would add a second relationship between the same tables and make
-- PostgREST embeds such as bookings -> services(...) ambiguous (PGRST201), so every writer is
-- checked by BEFORE triggers instead: each listed reference must belong to the row's business.
-- Production had no inconsistent rows when this was written (18 Nov 2026).
begin;

create schema if not exists private;
revoke all on schema private from public;

-- TG_ARGV: 'column:table' pairs; table.id = NEW.column must have table.biz_id = NEW.biz_id.
create or replace function private.tenant_reference_guard()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
    v_new jsonb := to_jsonb(new);
    v_old jsonb := case when tg_op = 'UPDATE' then to_jsonb(old) end;
    v_biz uuid := (v_new ->> 'biz_id')::uuid;
    v_arg text;
    v_column text;
    v_table text;
    v_id uuid;
    v_ok boolean;
begin
    foreach v_arg in array tg_argv loop
        v_column := split_part(v_arg, ':', 1);
        v_table := split_part(v_arg, ':', 2);
        v_id := (v_new ->> v_column)::uuid;
        continue when v_id is null;
        continue when tg_op = 'UPDATE'
            and v_old ->> v_column is not distinct from v_new ->> v_column
            and v_old ->> 'biz_id' is not distinct from v_new ->> 'biz_id';
        execute format('select exists (select 1 from public.%I where id = $1 and biz_id = $2)', v_table)
            into v_ok using v_id, v_biz;
        if not v_ok then
            raise exception using errcode = '23503', message = 'TENANT_REFERENCE_MISMATCH',
                detail = format('%s.%s must belong to the business of the row', tg_table_name, v_column);
        end if;
    end loop;
    return new;
end;
$$;

-- service_staff has no biz_id: the service and the master must belong to one business.
create or replace function private.service_staff_same_business()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
begin
    if tg_op = 'UPDATE' and new.service_id is not distinct from old.service_id
       and new.staff_id is not distinct from old.staff_id then
        return new;
    end if;
    if not exists (select 1 from public.services s join public.staff st on st.biz_id = s.biz_id
                    where s.id = new.service_id and st.id = new.staff_id) then
        raise exception using errcode = '23503', message = 'TENANT_REFERENCE_MISMATCH',
            detail = 'service_staff must link a service and a master of the same business';
    end if;
    return new;
end;
$$;

revoke all on function private.tenant_reference_guard(), private.service_staff_same_business() from public, anon, authenticated, service_role;

drop trigger if exists tenant_reference_guard on public.staff;
create trigger tenant_reference_guard before insert or update on public.staff
    for each row execute function private.tenant_reference_guard('branch_id:branches');
drop trigger if exists tenant_reference_guard on public.services;
create trigger tenant_reference_guard before insert or update on public.services
    for each row execute function private.tenant_reference_guard('branch_id:branches');
drop trigger if exists tenant_reference_guard on public.staff_branch_assignments;
create trigger tenant_reference_guard before insert or update on public.staff_branch_assignments
    for each row execute function private.tenant_reference_guard('staff_id:staff', 'branch_id:branches');
drop trigger if exists tenant_reference_guard on public.staff_schedule_rules;
create trigger tenant_reference_guard before insert or update on public.staff_schedule_rules
    for each row execute function private.tenant_reference_guard('staff_id:staff', 'branch_id:branches');
drop trigger if exists tenant_reference_guard on public.working_hours;
create trigger tenant_reference_guard before insert or update on public.working_hours
    for each row execute function private.tenant_reference_guard('staff_id:staff');
drop trigger if exists tenant_reference_guard on public.branch_promotions;
create trigger tenant_reference_guard before insert or update on public.branch_promotions
    for each row execute function private.tenant_reference_guard('branch_id:branches');
drop trigger if exists tenant_reference_guard on public.branch_working_hours;
create trigger tenant_reference_guard before insert or update on public.branch_working_hours
    for each row execute function private.tenant_reference_guard('branch_id:branches');
drop trigger if exists tenant_reference_guard on public.visit_package_plans;
create trigger tenant_reference_guard before insert or update on public.visit_package_plans
    for each row execute function private.tenant_reference_guard('service_id:services');
drop trigger if exists tenant_reference_guard on public.bookings;
create trigger tenant_reference_guard before insert or update on public.bookings
    for each row execute function private.tenant_reference_guard('branch_id:branches', 'staff_id:staff', 'service_id:services');
drop trigger if exists service_staff_same_business on public.service_staff;
create trigger service_staff_same_business before insert or update on public.service_staff
    for each row execute function private.service_staff_same_business();

commit;
