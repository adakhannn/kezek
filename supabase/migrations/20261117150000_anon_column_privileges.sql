-- The public anon key could read every column of approved businesses and their active staff:
-- staff e-mail, phone, auth user id and pay terms (percent_master, percent_salon, hourly_rate),
-- and the business owner's user id, owner notification e-mails and internal creation links.
-- Public pages, booking, search, map, sitemap and the mobile catalog select only public
-- columns, so anon gets column-level SELECT on exactly those (checked against production in
-- a rolled-back transaction). Signed-in roles are unchanged.
-- New columns are not visible to anon until granted here.
begin;

revoke select on table public.staff from anon;
grant select (
    id, biz_id, branch_id, full_name, skills, is_active, created_at, avatar_url,
    rating_score, rating_updated_at, last_rating_recalculated_at
) on table public.staff to anon;

revoke select on table public.businesses from anon;
grant select (
    id, name, slug, phones, address, coords, categories, tz, plan, is_approved, created_at,
    rating_score, rating_updated_at, city_id, last_rating_recalculated_at, branch_limit,
    creation_source, contact_phone, contact_whatsapp, contact_email, website_url
) on table public.businesses to anon;

commit;
