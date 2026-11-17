-- Any signed-in account (registration is open) could read, through PostgREST, the e-mail,
-- phone and pay terms of every active staff member of an approved business, and the owner
-- notification e-mails and creation links of every approved business.
-- `authenticated` now has column-level SELECT without those columns; the application reads
-- them through staff_private_fields() (20261117160000) or with the service role.
-- staff.user_id and businesses.owner_id stay readable: RLS policies across the schema
-- compare them with auth.uid() in sub-queries, which run with the caller's privileges.
-- New columns of these tables are not visible to `authenticated` until granted here.
begin;

revoke select on table public.staff from authenticated;
grant select (
    id, biz_id, branch_id, full_name, skills, is_active, created_at, user_id, avatar_url,
    rating_score, rating_updated_at, last_rating_recalculated_at
) on table public.staff to authenticated;

revoke select on table public.businesses from authenticated;
grant select (
    id, name, slug, phones, address, coords, categories, tz, plan, is_approved, owner_id, created_at,
    rating_score, rating_updated_at, city_id, last_rating_recalculated_at, branch_limit,
    creation_source, contact_phone, contact_whatsapp, contact_email, website_url
) on table public.businesses to authenticated;

commit;
