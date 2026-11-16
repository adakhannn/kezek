-- user_roles.biz_key is generated in production and must not be inserted explicitly.

create or replace function public.approve_staff_application(
    p_application_id uuid,
    p_reviewer_user_id uuid,
    p_branch_id uuid,
    p_is_active boolean default true
)
returns table (
    staff_id uuid,
    biz_id uuid,
    branch_id uuid
)
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
    v_application public.business_role_applications%rowtype;
    v_role_id uuid;
    v_staff_id uuid;
    v_today date := current_date;
begin
    select *
      into v_application
      from public.business_role_applications
     where id = p_application_id
     for update;

    if not found then
        raise exception using errcode = 'P0002', message = 'application_not_found';
    end if;

    if v_application.status <> 'pending' then
        raise exception using errcode = '23505', message = 'application_already_processed';
    end if;

    if v_application.requested_role <> 'staff' then
        raise exception using errcode = '22023', message = 'application_is_not_staff';
    end if;

    if not exists (
        select 1
          from public.branches b
         where b.id = p_branch_id
           and b.biz_id = v_application.biz_id
           and coalesce(b.is_active, true)
    ) then
        raise exception using errcode = '22023', message = 'invalid_or_inactive_branch';
    end if;

    select r.id
      into v_role_id
      from public.roles r
     where r.key = 'staff'
     limit 1;

    if v_role_id is null then
        raise exception using errcode = 'P0002', message = 'staff_role_not_found';
    end if;

    select s.id
      into v_staff_id
      from public.staff s
     where s.user_id = v_application.applicant_user_id
       and s.biz_id = v_application.biz_id
     for update;

    if v_staff_id is null then
        insert into public.staff (
            user_id,
            biz_id,
            branch_id,
            full_name,
            email,
            phone,
            is_active
        ) values (
            v_application.applicant_user_id,
            v_application.biz_id,
            p_branch_id,
            coalesce(
                nullif(btrim(v_application.applicant_name), ''),
                nullif(btrim(v_application.applicant_email), ''),
                nullif(btrim(v_application.applicant_phone), ''),
                'Сотрудник'
            ),
            v_application.applicant_email,
            v_application.applicant_phone,
            p_is_active
        )
        returning id into v_staff_id;
    else
        update public.staff
           set branch_id = p_branch_id,
               is_active = p_is_active,
               email = coalesce(email, v_application.applicant_email),
               phone = coalesce(phone, v_application.applicant_phone)
         where id = v_staff_id;
    end if;

    insert into public.user_roles (user_id, role_id, biz_id)
    select v_application.applicant_user_id, v_role_id, v_application.biz_id
     where not exists (
        select 1
          from public.user_roles ur
         where ur.user_id = v_application.applicant_user_id
           and ur.role_id = v_role_id
           and ur.biz_id = v_application.biz_id
    );

    insert into public.staff_branch_assignments (
        biz_id,
        staff_id,
        branch_id,
        valid_from
    )
    select v_application.biz_id, v_staff_id, p_branch_id, v_today
     where not exists (
        select 1
          from public.staff_branch_assignments sba
         where sba.biz_id = v_application.biz_id
           and sba.staff_id = v_staff_id
           and sba.branch_id = p_branch_id
           and sba.valid_to is null
    );

    update public.business_role_applications
       set status = 'approved',
           reviewed_at = now(),
           reviewed_by = p_reviewer_user_id,
           review_note = null,
           updated_at = now()
     where id = p_application_id;

    return query
    select v_staff_id, v_application.biz_id, p_branch_id;
end;
$$;

revoke all on function public.approve_staff_application(uuid, uuid, uuid, boolean) from public;
revoke all on function public.approve_staff_application(uuid, uuid, uuid, boolean) from anon;
revoke all on function public.approve_staff_application(uuid, uuid, uuid, boolean) from authenticated;
grant execute on function public.approve_staff_application(uuid, uuid, uuid, boolean) to service_role;
