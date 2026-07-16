-- A single user may own multiple businesses.
-- Ownership is scoped to each business through businesses.owner_id and user_roles.
-- Remove the legacy global uniqueness constraint that incorrectly limited one
-- owner to one business and blocked legitimate registration approvals.
alter table public.businesses
    drop constraint if exists businesses_one_owner_per_user;

comment on column public.businesses.owner_id is
    'Primary owner of this business. The same user may own multiple businesses.';
