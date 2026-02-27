-- Дополнительные индексы для аналитических агрегатов

-- Для business_daily_stats: быстрый доступ по biz_id + date
create index if not exists business_daily_stats_biz_date_idx
    on public.business_daily_stats (biz_id, date);

-- Для business_hourly_load индекс уже создаётся в отдельной миграции:
-- business_hourly_load_biz_branch_date_idx on (biz_id, branch_id, date)
-- здесь просто оставляем комментарий для полноты картины.

