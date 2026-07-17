-- One owner may own multiple businesses. The owner relationship is scoped by
-- the business itself and must not be globally unique across businesses.
drop index if exists public.businesses_one_owner_per_user;
