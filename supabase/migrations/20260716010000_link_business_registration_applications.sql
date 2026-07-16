alter table public.business_registration_applications
    add column if not exists created_business_id uuid references public.businesses(id) on delete set null;

create index if not exists business_registration_applications_created_business_idx
    on public.business_registration_applications(created_business_id)
    where created_business_id is not null;

comment on column public.business_registration_applications.created_business_id is
    'Business created from this public registration application after super-admin approval.';
