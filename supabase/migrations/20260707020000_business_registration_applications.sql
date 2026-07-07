create table if not exists public.business_registration_applications (
    id uuid primary key default gen_random_uuid(),
    applicant_user_id uuid references auth.users(id) on delete set null,
    contact_name text not null,
    phone text not null,
    email text,
    business_name text not null,
    city text,
    category text,
    comment text,
    status text not null default 'new' check (status in ('new', 'contacted', 'approved', 'rejected')),
    source text not null default 'web',
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    reviewed_at timestamptz,
    reviewed_by uuid references auth.users(id) on delete set null
);

alter table public.business_registration_applications enable row level security;
revoke all on public.business_registration_applications from anon, authenticated;
grant all on public.business_registration_applications to service_role;

create index if not exists business_registration_applications_status_created_idx
    on public.business_registration_applications(status, created_at desc);

create index if not exists business_registration_applications_phone_created_idx
    on public.business_registration_applications(phone, created_at desc);
