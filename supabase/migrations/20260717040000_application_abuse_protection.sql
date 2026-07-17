-- Central anti-abuse policy for business registration and role applications.
-- API rate limits are only the first line of defence; these database guards
-- keep limits deterministic under concurrent requests and alternate clients.

alter table public.business_registration_applications
    add column if not exists prior_submission_count integer not null default 0,
    add column if not exists risk_flags text[] not null default '{}',
    add column if not exists review_note text;

alter table public.business_role_applications
    add column if not exists prior_submission_count integer not null default 0,
    add column if not exists risk_flags text[] not null default '{}',
    add column if not exists evidence_links jsonb not null default '{}'::jsonb;

alter table public.business_role_applications
    drop constraint if exists business_role_applications_evidence_links_object;

alter table public.business_role_applications
    add constraint business_role_applications_evidence_links_object
    check (jsonb_typeof(evidence_links) = 'object');

create table if not exists public.application_submission_blocks (
    id uuid primary key default gen_random_uuid(),
    application_kind text not null check (application_kind in ('business_registration', 'owner', 'staff')),
    subject_user_id uuid references auth.users(id) on delete cascade,
    subject_phone text,
    biz_id uuid references public.businesses(id) on delete cascade,
    blocked_until timestamptz not null,
    reason text,
    created_by uuid references auth.users(id) on delete set null,
    created_at timestamptz not null default now(),
    check (subject_user_id is not null or subject_phone is not null)
);

create index if not exists application_submission_blocks_lookup_idx
    on public.application_submission_blocks(application_kind, subject_user_id, biz_id, blocked_until desc);

create index if not exists application_submission_blocks_phone_lookup_idx
    on public.application_submission_blocks(application_kind, subject_phone, blocked_until desc)
    where subject_phone is not null;

alter table public.application_submission_blocks enable row level security;
revoke all on public.application_submission_blocks from anon, authenticated;
grant all on public.application_submission_blocks to service_role;

create table if not exists public.application_moderation_actions (
    id uuid primary key default gen_random_uuid(),
    application_kind text not null check (application_kind in ('business_registration', 'owner', 'staff')),
    application_id uuid not null,
    action text not null check (action in ('approved', 'rejected', 'rejected_and_blocked', 'cancelled')),
    actor_user_id uuid references auth.users(id) on delete set null,
    target_user_id uuid references auth.users(id) on delete set null,
    biz_id uuid references public.businesses(id) on delete set null,
    reason text,
    blocked_until timestamptz,
    metadata jsonb not null default '{}'::jsonb,
    created_at timestamptz not null default now()
);

create index if not exists application_moderation_actions_application_idx
    on public.application_moderation_actions(application_kind, application_id, created_at desc);

alter table public.application_moderation_actions enable row level security;
revoke all on public.application_moderation_actions from anon, authenticated;
grant all on public.application_moderation_actions to service_role;

create or replace function public.enforce_business_registration_application_policy()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
    v_identity text;
    v_active_count integer;
    v_month_count integer;
    v_prior_count integer;
    v_rejected_count integer;
begin
    v_identity := coalesce(new.applicant_user_id::text, new.phone);
    perform pg_advisory_xact_lock(hashtextextended('business-registration:' || v_identity, 0));

    if exists (
        select 1
        from public.application_submission_blocks b
        where b.application_kind = 'business_registration'
          and b.blocked_until > now()
          and (
              (new.applicant_user_id is not null and b.subject_user_id = new.applicant_user_id)
              or (b.subject_phone is not null and b.subject_phone = new.phone)
          )
    ) then
        raise exception using errcode = 'P0001', message = 'APPLICATION_POLICY:blocked';
    end if;

    if exists (
        select 1
        from public.business_registration_applications a
        where a.status in ('new', 'contacted')
          and lower(btrim(a.business_name)) = lower(btrim(new.business_name))
          and (
              (new.applicant_user_id is not null and a.applicant_user_id = new.applicant_user_id)
              or a.phone = new.phone
          )
    ) then
        raise exception using errcode = 'P0001', message = 'APPLICATION_POLICY:pending_duplicate';
    end if;

    select count(*) into v_active_count
    from public.business_registration_applications a
    where a.status in ('new', 'contacted')
      and (
          (new.applicant_user_id is not null and a.applicant_user_id = new.applicant_user_id)
          or a.phone = new.phone
      );
    if v_active_count >= 2 then
        raise exception using errcode = 'P0001', message = 'APPLICATION_POLICY:active_limit';
    end if;

    select count(*) into v_month_count
    from public.business_registration_applications a
    where a.created_at >= now() - interval '30 days'
      and (
          (new.applicant_user_id is not null and a.applicant_user_id = new.applicant_user_id)
          or a.phone = new.phone
      );
    if v_month_count >= 3 then
        raise exception using errcode = 'P0001', message = 'APPLICATION_POLICY:monthly_limit';
    end if;

    if exists (
        select 1
        from public.business_registration_applications a
        where a.status = 'rejected'
          and coalesce(a.reviewed_at, a.updated_at) > now() - interval '24 hours'
          and (
              (new.applicant_user_id is not null and a.applicant_user_id = new.applicant_user_id)
              or a.phone = new.phone
          )
    ) then
        raise exception using errcode = 'P0001', message = 'APPLICATION_POLICY:cooldown_24h';
    end if;

    select count(*), count(*) filter (where a.status = 'rejected')
      into v_prior_count, v_rejected_count
    from public.business_registration_applications a
    where (new.applicant_user_id is not null and a.applicant_user_id = new.applicant_user_id)
       or a.phone = new.phone;

    new.prior_submission_count := v_prior_count;
    new.risk_flags := array_remove(array[
        case when new.applicant_user_id is null then 'guest_submission' end,
        case when v_prior_count > 0 then 'repeat_applicant' end,
        case when v_rejected_count >= 2 then 'multiple_rejections' end
    ], null);
    return new;
end;
$$;

drop trigger if exists business_registration_application_policy on public.business_registration_applications;
create trigger business_registration_application_policy
before insert on public.business_registration_applications
for each row execute function public.enforce_business_registration_application_policy();

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

    if new.requested_role = 'owner'
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

drop trigger if exists business_role_application_policy on public.business_role_applications;
create trigger business_role_application_policy
before insert on public.business_role_applications
for each row execute function public.enforce_business_role_application_policy();

create or replace function public.reject_application_with_policy(
    p_application_kind text,
    p_application_id uuid,
    p_reviewer_user_id uuid,
    p_reason text default null,
    p_block_days integer default 0
)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
    v_user_id uuid;
    v_phone text;
    v_biz_id uuid;
    v_role text;
    v_blocked_until timestamptz;
begin
    if p_block_days < 0 or p_block_days > 365 then
        raise exception using errcode = '22023', message = 'invalid block duration';
    end if;

    if p_application_kind = 'business_registration' then
        update public.business_registration_applications
           set status = 'rejected', reviewed_at = now(), reviewed_by = p_reviewer_user_id,
               review_note = nullif(btrim(p_reason), ''), updated_at = now()
         where id = p_application_id and status in ('new', 'contacted')
         returning applicant_user_id, phone into v_user_id, v_phone;
        if not found then return false; end if;
    elsif p_application_kind in ('owner', 'staff') then
        update public.business_role_applications
           set status = 'rejected', reviewed_at = now(), reviewed_by = p_reviewer_user_id,
               review_note = nullif(btrim(p_reason), ''), updated_at = now()
         where id = p_application_id and status = 'pending' and requested_role = p_application_kind
         returning applicant_user_id, biz_id, requested_role into v_user_id, v_biz_id, v_role;
        if not found then return false; end if;
    else
        raise exception using errcode = '22023', message = 'invalid application kind';
    end if;

    if p_block_days > 0 then
        v_blocked_until := now() + make_interval(days => p_block_days);
        insert into public.application_submission_blocks(
            application_kind, subject_user_id, subject_phone, biz_id,
            blocked_until, reason, created_by
        ) values (
            p_application_kind, v_user_id, case when v_user_id is null then v_phone else null end,
            v_biz_id, v_blocked_until, nullif(btrim(p_reason), ''), p_reviewer_user_id
        );
    end if;

    insert into public.application_moderation_actions(
        application_kind, application_id, action, actor_user_id,
        target_user_id, biz_id, reason, blocked_until
    ) values (
        p_application_kind, p_application_id,
        case when p_block_days > 0 then 'rejected_and_blocked' else 'rejected' end,
        p_reviewer_user_id, v_user_id, v_biz_id, nullif(btrim(p_reason), ''), v_blocked_until
    );
    return true;
end;
$$;

revoke all on function public.reject_application_with_policy(text, uuid, uuid, text, integer) from public, anon, authenticated;
grant execute on function public.reject_application_with_policy(text, uuid, uuid, text, integer) to service_role;

comment on table public.application_submission_blocks is
    'Time-bound, moderator-created submission blocks enforced by database application policy triggers.';
comment on table public.application_moderation_actions is
    'Append-only audit trail for application moderation decisions.';
