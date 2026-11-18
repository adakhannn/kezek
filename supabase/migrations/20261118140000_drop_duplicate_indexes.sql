-- Exact duplicate indexes (same columns in the same order, same predicate, same uniqueness) made
-- every write to these tables maintain two identical trees (17 Nov review,
-- docs/PROJECT_REVIEW_2026-11-17.md DB-17). No constraint, code or migration refers to the dropped
-- names; ON CONFLICT inference keeps finding the identical index that stays. Production had the
-- same four pairs on 18 Nov 2026. Duplicate triggers were checked too: there are none.
begin;

drop index if exists public.idx_bookings_staff_start;         -- = bookings_staff_id_start_at_idx (staff_id, start_at)
drop index if exists public.staff_shifts_staff_date_idx;      -- = staff_shifts_staff_id_shift_date_idx (staff_id, shift_date)
drop index if exists public.ux_user_roles_business;           -- = user_roles_uq_triplet_scoped (user_id, biz_id, role_id) where biz_id is not null
drop index if exists public.user_roles_unique_triplet;        -- = user_roles_uniq (user_id, role_id, biz_id)

commit;
