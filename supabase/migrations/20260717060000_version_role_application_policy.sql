-- Keep database policy compatible during a rolling web deployment. Legacy
-- clients submit policy_version=0; the new web client explicitly sends 1.
alter table public.business_role_applications
    add column if not exists policy_version integer not null default 0
    check (policy_version >= 0);

create or replace function public.enforce_business_role_application_policy()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
    v_pending_limit integer;
    v_cooldown interval;
    v_prior_count integer;
    v_rejected_count integer;
begin
    perform pg_advisory_xact_lock(hashtextextended('business-role:' || new.applicant_user_id::text || ':' || new.requested_role, 0));

    if new.requested_role not in ('owner', 'staff') then
        raise exception using errcode = 'P0001', message = 'APPLICATION_POLICY:unsupported_role';
    end if;

    if new.policy_version >= 1
       and new.requested_role = 'owner'
       and coalesce(length(btrim(new.message)), 0) < 20
       and new.evidence_links = '{}'::jsonb then
        raise exception using errcode = 'P0001', message = 'APPLICATION_POLICY:owner_evidence_required';
    end if;

    if exists (
        select 1
        from public.application_submission_blocks b
        where b.application_kind = new.requested_role
          and b.subject_user_id = new.applicant_user_id
          and b.blocked_until > now()
          and (b.biz_id is null or b.biz_id = new.biz_id)
    ) then
        raise exception using errcode = 'P0001', message = 'APPLICATION_POLICY:blocked';
    end if;

    if new.requested_role = 'staff' and exists (
        select 1
        from public.user_roles ur
        join public.roles r on r.id = ur.role_id
        where ur.user_id = new.applicant_user_id
          and ur.biz_id = new.biz_id
          and r.key = 'owner'
    ) then
        raise exception using errcode = 'P0001', message = 'APPLICATION_POLICY:owner_cannot_be_staff';
    end if;

    v_pending_limit := case when new.requested_role = 'owner' then 3 else 5 end;
    if (select count(*) from public.business_role_applications a
        where a.applicant_user_id = new.applicant_user_id
          and a.requested_role = new.requested_role
          and a.status = 'pending') >= v_pending_limit then
        raise exception using errcode = 'P0001', message = 'APPLICATION_POLICY:active_limit';
    end if;

    v_cooldown := case when new.requested_role = 'owner' then interval '7 days' else interval '3 days' end;
    if exists (
        select 1
        from public.business_role_applications a
        where a.applicant_user_id = new.applicant_user_id
          and a.biz_id = new.biz_id
          and a.requested_role = new.requested_role
          and a.status = 'rejected'
          and coalesce(a.reviewed_at, a.updated_at) > now() - v_cooldown
    ) then
        raise exception using errcode = 'P0001', message = case
            when new.requested_role = 'owner' then 'APPLICATION_POLICY:cooldown_7d'
            else 'APPLICATION_POLICY:cooldown_3d'
        end;
    end if;

    select count(*), count(*) filter (where a.status = 'rejected')
      into v_prior_count, v_rejected_count
    from public.business_role_applications a
    where a.applicant_user_id = new.applicant_user_id
      and a.requested_role = new.requested_role;

    new.prior_submission_count := v_prior_count;
    new.risk_flags := array_remove(array[
        case when v_prior_count > 0 then 'repeat_applicant' end,
        case when v_rejected_count > 0 then 'prior_rejection' end,
        case when v_prior_count >= 3 then 'high_submission_volume' end
    ], null);
    return new;
end;
$$;

comment on column public.business_role_applications.policy_version is
    'Submission policy contract version. Version 1 enables structured owner-proof enforcement.';
