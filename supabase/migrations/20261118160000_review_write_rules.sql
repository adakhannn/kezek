-- Review rules existed only on paper (17 Nov review, docs/PROJECT_REVIEW_2026-11-17.md DB-13).
-- Permissive policies are OR-ed per command, so the January 2026 policies overrode
-- can_review / can_edit_review: "Users can insert own reviews" accepted any own booking (before
-- the visit, cancelled, no-show); "Users can update own reviews" checked only client_id, so
-- booking_id could be pointed at any booking (FK checks ignore RLS) and the review then counted
-- for that booking's master and showed under that booking's client; reviews_update_self checked
-- can_edit_review(id) on the stored row, so booking_id, client_id and created_at were writable;
-- anon held every write privilege.
-- Now: a review is created for an own visit whose attendance the business confirmed (status paid,
-- visit started), exactly when the cabinet offers it; its author edits rating and comment at any
-- time (the product decision of 30 Dec 2025, commit 58488a64); id, booking_id, client_id and
-- created_at are set by the server; clients do not delete reviews (no screen does); anon writes
-- nothing. Existing reviews are not changed (production had one, which passes the new rules).
begin;

create or replace function public.can_review(p_booking_id uuid)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
    select exists (
        select 1 from public.bookings b
         where b.id = p_booking_id
           and b.client_id = (select auth.uid())
           and b.status = 'paid'
           and b.start_at <= now());
$$;

create or replace function public.can_edit_review(p_id uuid)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
    select exists (
        select 1 from public.reviews r
         where r.id = p_id
           and r.client_id = (select auth.uid()));
$$;

revoke all on function public.can_review(uuid), public.can_edit_review(uuid) from public, anon;
grant execute on function public.can_review(uuid), public.can_edit_review(uuid) to authenticated, service_role;

-- SECURITY INVOKER on purpose: current_user is the client role for PostgREST writes; the service
-- role and SECURITY DEFINER commands (account deletion) stay unrestricted.
create or replace function public.reviews_set_client_id()
returns trigger
language plpgsql
set search_path = pg_catalog, public
as $$
begin
    if tg_op = 'INSERT' then
        new.client_id := auth.uid();
        if current_user in ('anon', 'authenticated') then
            new.created_at := now();
        end if;
    elsif current_user in ('anon', 'authenticated')
          and (new.id, new.booking_id, new.client_id, new.created_at)
              is distinct from (old.id, old.booking_id, old.client_id, old.created_at) then
        raise exception 'REVIEW_FIELD_READ_ONLY' using errcode = '42501';
    end if;
    new.updated_at := now();
    return new;
end;
$$;

drop policy if exists "Users can insert own reviews" on public.reviews;
drop policy if exists "Users can update own reviews" on public.reviews;
drop policy if exists reviews_insert_self on public.reviews;
drop policy if exists reviews_update_self on public.reviews;
drop policy if exists reviews_delete_self on public.reviews;

create policy reviews_insert_self on public.reviews
    for insert to authenticated
    with check (client_id = (select auth.uid()) and public.can_review(booking_id));

create policy reviews_update_self on public.reviews
    for update to authenticated
    using (public.can_edit_review(id))
    with check (client_id = (select auth.uid()));

revoke insert, update, delete on table public.reviews from public, anon;
revoke delete on table public.reviews from authenticated;

commit;
