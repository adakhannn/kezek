create table if not exists public.business_role_applications (
    id uuid primary key default gen_random_uuid(),
    applicant_user_id uuid not null references auth.users(id) on delete cascade,
    biz_id uuid not null references public.businesses(id) on delete cascade,
    requested_role text not null check (requested_role in ('owner', 'admin', 'manager', 'staff')),
    status text not null default 'pending' check (status in ('pending', 'approved', 'rejected', 'cancelled')),
    applicant_name text,
    applicant_email text,
    applicant_phone text,
    message text,
    source text not null default 'web',
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    reviewed_at timestamptz,
    reviewed_by uuid references auth.users(id) on delete set null,
    review_note text
);

alter table public.business_role_applications enable row level security;
revoke all on public.business_role_applications from anon, authenticated;
grant all on public.business_role_applications to service_role;

create unique index if not exists business_role_applications_pending_unique
    on public.business_role_applications(applicant_user_id, biz_id, requested_role)
    where status = 'pending';

create index if not exists business_role_applications_biz_status_created_idx
    on public.business_role_applications(biz_id, status, created_at desc);

create index if not exists business_role_applications_user_created_idx
    on public.business_role_applications(applicant_user_id, created_at desc);

comment on table public.business_role_applications is
    'Self-service requests from signed-in users to become an owner/admin/manager/staff member of an existing business.';
