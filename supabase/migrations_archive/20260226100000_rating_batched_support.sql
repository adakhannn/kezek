-- Поддержка батчевой инициализации рейтингов для больших баз
-- Позволяет вызывать recalculate_ratings_for_date_range по частям (по диапазонам дат),
-- затем один раз вызвать update_all_aggregated_ratings() для обновления итоговых рейтингов.

create or replace function public.update_all_aggregated_ratings()
returns void
language plpgsql
as $$
declare
    r_staff record;
    r_branch record;
    r_biz record;
    v_staff_rating numeric;
    v_branch_rating numeric;
    v_biz_rating numeric;
    v_default_rating numeric := 50.0;
begin
    raise notice 'Updating aggregated ratings for all active staff, branches, and approved businesses...';

    for r_staff in select id from public.staff where is_active = true loop
        begin
            v_staff_rating := public.calculate_staff_rating(r_staff.id);
            if v_staff_rating is null then
                v_staff_rating := v_default_rating;
            end if;
            update public.staff set rating_score = v_staff_rating where id = r_staff.id;
        exception when others then
            raise notice 'Error calculating staff rating for staff_id=%: %', r_staff.id, SQLERRM;
            update public.staff set rating_score = v_default_rating where id = r_staff.id and rating_score is null;
        end;
    end loop;

    for r_branch in select id from public.branches where is_active = true loop
        begin
            v_branch_rating := public.calculate_branch_rating(r_branch.id);
            if v_branch_rating is null then
                select coalesce(avg(rating_score), v_default_rating) into v_branch_rating
                from public.staff
                where branch_id = r_branch.id and is_active = true and rating_score is not null;
            end if;
            update public.branches set rating_score = v_branch_rating where id = r_branch.id;
        exception when others then
            raise notice 'Error calculating branch rating for branch_id=%: %', r_branch.id, SQLERRM;
            update public.branches set rating_score = v_default_rating where id = r_branch.id and rating_score is null;
        end;
    end loop;

    for r_biz in select id from public.businesses where is_approved = true loop
        begin
            v_biz_rating := public.calculate_biz_rating(r_biz.id);
            if v_biz_rating is null then
                select coalesce(avg(rating_score), v_default_rating) into v_biz_rating
                from public.branches
                where biz_id = r_biz.id and is_active = true and rating_score is not null;
            end if;
            update public.businesses set rating_score = v_biz_rating where id = r_biz.id;
        exception when others then
            raise notice 'Error calculating biz rating for biz_id=%: %', r_biz.id, SQLERRM;
            update public.businesses set rating_score = v_default_rating where id = r_biz.id and rating_score is null;
        end;
    end loop;

    raise notice 'Aggregated ratings update completed';
end;
$$;

comment on function public.update_all_aggregated_ratings() is 'Обновляет агрегированные рейтинги (rating_score) для всех активных staff, branches и одобренных businesses по уже рассчитанным дневным метрикам. Вызывать после батчевого пересчёта метрик по диапазонам дат.';
