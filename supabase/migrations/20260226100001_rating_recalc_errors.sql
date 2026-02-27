-- Таблица для фиксации ошибок пересчёта рейтингов (наблюдаемость)
create table if not exists public.rating_recalc_errors (
    id uuid primary key default gen_random_uuid(),
    entity_id uuid not null,
    entity_type text not null check (entity_type in ('staff', 'branch', 'business')),
    metric_date date not null,
    error_message text not null,
    created_at timestamptz not null default timezone('utc'::text, now())
);

comment on table public.rating_recalc_errors is 'Ошибки пересчёта рейтингов из recalculate_ratings_for_date для диагностики';
create index if not exists rating_recalc_errors_created_at_idx on public.rating_recalc_errors (created_at desc);
create index if not exists rating_recalc_errors_entity_type_date_idx on public.rating_recalc_errors (entity_type, metric_date);

alter table public.rating_recalc_errors enable row level security;

drop policy if exists "Rating recalc errors select superadmin" on public.rating_recalc_errors;
create policy "Rating recalc errors select superadmin"
    on public.rating_recalc_errors
    for select
    to authenticated
    using (
        exists (
            select 1
            from public.user_roles_with_user ur
            where ur.user_id = auth.uid()
              and ur.role_key = 'super_admin'
              and ur.biz_id is null
        )
    );

-- Функция пересчёта обновлена: при ошибке пишем в rating_recalc_errors и делаем raise warning
create or replace function public.recalculate_ratings_for_date(
    p_date date default current_date - interval '1 day'
)
returns void
language plpgsql
security definer
as $$
declare
    v_staff record;
    v_branch record;
    v_biz record;
begin
    -- Пересчитываем метрики для всех активных сотрудников за указанную дату
    for v_staff in
        select id from public.staff where is_active = true
    loop
        begin
            perform public.calculate_staff_day_metrics(v_staff.id, p_date);
        exception when others then
            insert into public.rating_recalc_errors (entity_id, entity_type, metric_date, error_message)
            values (v_staff.id, 'staff', p_date, SQLERRM);
            raise warning 'Error calculating metrics for staff %: %', v_staff.id, sqlerrm;
        end;
    end loop;

    for v_branch in
        select id from public.branches where is_active = true
    loop
        begin
            perform public.calculate_branch_day_metrics(v_branch.id, p_date);
        exception when others then
            insert into public.rating_recalc_errors (entity_id, entity_type, metric_date, error_message)
            values (v_branch.id, 'branch', p_date, SQLERRM);
            raise warning 'Error calculating metrics for branch %: %', v_branch.id, sqlerrm;
        end;
    end loop;

    for v_biz in
        select id from public.businesses where is_approved = true
    loop
        begin
            perform public.calculate_biz_day_metrics(v_biz.id, p_date);
        exception when others then
            insert into public.rating_recalc_errors (entity_id, entity_type, metric_date, error_message)
            values (v_biz.id, 'business', p_date, SQLERRM);
            raise warning 'Error calculating metrics for biz %: %', v_biz.id, sqlerrm;
        end;
    end loop;

    -- Пересчитываем агрегированные рейтинги
    for v_staff in
        select id from public.staff where is_active = true
    loop
        begin
            perform public.calculate_staff_rating(v_staff.id);
        exception when others then
            insert into public.rating_recalc_errors (entity_id, entity_type, metric_date, error_message)
            values (v_staff.id, 'staff', p_date, 'aggregate: ' || SQLERRM);
            raise warning 'Error calculating rating for staff %: %', v_staff.id, sqlerrm;
        end;
    end loop;

    for v_branch in
        select id from public.branches where is_active = true
    loop
        begin
            perform public.calculate_branch_rating(v_branch.id);
        exception when others then
            insert into public.rating_recalc_errors (entity_id, entity_type, metric_date, error_message)
            values (v_branch.id, 'branch', p_date, 'aggregate: ' || SQLERRM);
            raise warning 'Error calculating rating for branch %: %', v_branch.id, sqlerrm;
        end;
    end loop;

    for v_biz in
        select id from public.businesses where is_approved = true
    loop
        begin
            perform public.calculate_biz_rating(v_biz.id);
        exception when others then
            insert into public.rating_recalc_errors (entity_id, entity_type, metric_date, error_message)
            values (v_biz.id, 'business', p_date, 'aggregate: ' || SQLERRM);
            raise warning 'Error calculating rating for biz %: %', v_biz.id, sqlerrm;
        end;
    end loop;
end;
$$;

comment on function public.recalculate_ratings_for_date(date) is 'Пересчитывает все рейтинги за указанную дату (по умолчанию вчера). Ошибки по сущностям пишет в rating_recalc_errors.';
