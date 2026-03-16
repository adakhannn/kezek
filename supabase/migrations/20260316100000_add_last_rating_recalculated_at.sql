-- Добавляем метаданные последнего успешного пересчёта рейтинга

alter table public.staff
    add column if not exists last_rating_recalculated_at timestamptz;

comment on column public.staff.last_rating_recalculated_at is 'Время последнего успешного вызова calculate_staff_rating для этого сотрудника';

alter table public.branches
    add column if not exists last_rating_recalculated_at timestamptz;

comment on column public.branches.last_rating_recalculated_at is 'Время последнего успешного вызова calculate_branch_rating для этого филиала';

alter table public.businesses
    add column if not exists last_rating_recalculated_at timestamptz;

comment on column public.businesses.last_rating_recalculated_at is 'Время последнего успешного вызова calculate_biz_rating для этого бизнеса';

