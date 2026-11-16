alter table public.businesses
    add column if not exists creation_source text not null default 'legacy',
    add column if not exists created_by_user_id uuid references auth.users(id) on delete set null,
    add column if not exists source_application_id uuid references public.business_registration_applications(id) on delete set null;

alter table public.businesses
    drop constraint if exists businesses_creation_source_check;

alter table public.businesses
    add constraint businesses_creation_source_check
    check (creation_source in ('legacy', 'public_application', 'admin_manual'));

create index if not exists businesses_created_by_user_id_idx
    on public.businesses (created_by_user_id)
    where created_by_user_id is not null;

create index if not exists businesses_source_application_id_idx
    on public.businesses (source_application_id)
    where source_application_id is not null;

create table if not exists public.business_creation_audit_log (
    id uuid primary key default gen_random_uuid(),
    business_id uuid not null references public.businesses(id) on delete cascade,
    event_type text not null,
    source text not null
        check (source in ('legacy', 'public_application', 'admin_manual')),
    actor_user_id uuid references auth.users(id) on delete set null,
    application_id uuid references public.business_registration_applications(id) on delete set null,
    reason text,
    metadata jsonb not null default '{}'::jsonb,
    created_at timestamptz not null default now()
);

create index if not exists business_creation_audit_log_business_created_idx
    on public.business_creation_audit_log (business_id, created_at desc);

create index if not exists business_creation_audit_log_actor_created_idx
    on public.business_creation_audit_log (actor_user_id, created_at desc)
    where actor_user_id is not null;

alter table public.business_creation_audit_log enable row level security;
revoke all on public.business_creation_audit_log from anon, authenticated;
grant all on public.business_creation_audit_log to service_role;

create or replace function public.audit_business_creation()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
    insert into public.business_creation_audit_log (
        business_id,
        event_type,
        source,
        actor_user_id,
        application_id,
        metadata,
        created_at
    )
    values (
        new.id,
        'created',
        new.creation_source,
        new.created_by_user_id,
        new.source_application_id,
        jsonb_build_object(
            'name', new.name,
            'slug', new.slug,
            'categories', coalesce(to_jsonb(new.categories), '[]'::jsonb),
            'branch_limit', new.branch_limit
        ),
        coalesce(new.created_at, now())
    );
    return new;
end;
$$;

drop trigger if exists businesses_audit_creation on public.businesses;
create trigger businesses_audit_creation
after insert on public.businesses
for each row execute function public.audit_business_creation();

insert into public.business_creation_audit_log (
    business_id,
    event_type,
    source,
    actor_user_id,
    application_id,
    metadata,
    created_at
)
select
    business.id,
    'created',
    'legacy',
    null,
    null,
    jsonb_build_object('backfilled', true),
    business.created_at
from public.businesses as business
where not exists (
    select 1
    from public.business_creation_audit_log as audit
    where audit.business_id = business.id
      and audit.event_type = 'created'
);

comment on column public.businesses.creation_source is
    'Origin of the business record: legacy, public application approval, or controlled admin creation.';
comment on column public.businesses.created_by_user_id is
    'User whose action created the business. This is the reviewer for public applications or the admin for manual creation.';
comment on column public.businesses.source_application_id is
    'Public business registration application that produced this business, when applicable.';
comment on table public.business_creation_audit_log is
    'Server-only audit trail for business creation and its administrative context.';
