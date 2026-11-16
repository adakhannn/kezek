-- Таблица фоновых задач пересчёта рейтингов

create table if not exists public.rating_jobs (
    id uuid primary key default gen_random_uuid(),

    -- Инициатор задачи (может быть null для системных cron-задач)
    created_by uuid,

    created_at timestamptz not null default timezone('utc'::text, now()),
    started_at timestamptz,
    finished_at timestamptz,

    -- Диапазон дат, для которого нужно выполнить пересчёт (включительно)
    date_from date not null,
    date_to date not null,

    -- Уровень пересчёта: staff / branch / biz / all
    scope text not null default 'all',

    -- Текущий статус job'ы
    -- queued: ожидает обработки
    -- running: в процессе
    -- success: успешно завершена
    -- error: завершена с ошибкой
    status text not null default 'queued',

    -- Прогресс по шагам (количество успешно обработанных дней)
    processed_days integer not null default 0,

    -- Общее количество дней в диапазоне (фиксируется при создании job)
    total_days integer not null default 0,

    -- Сводка по ошибкам в формате JSON (аггрегированная информация)
    error_summary jsonb,

    -- Детальное сообщение об ошибке (если есть)
    error_message text
);

comment on table public.rating_jobs is 'Фоновые задачи по пересчёту рейтингов (используются воркерами / cron).';
comment on column public.rating_jobs.created_by is 'Инициатор задачи пересчёта рейтингов (user_id) или null для системного cron.';
comment on column public.rating_jobs.scope is 'Уровень пересчёта: staff / branch / biz / all.';
comment on column public.rating_jobs.status is 'Статус задачи пересчёта рейтингов: queued, running, success, error.';
comment on column public.rating_jobs.processed_days is 'Количество успешно обработанных дней в диапазоне.';
comment on column public.rating_jobs.total_days is 'Общее количество дней в диапазоне (фиксируется при создании job).';

alter table public.rating_jobs enable row level security;

-- Только суперадмины могут управлять задачами
drop policy if exists "Rating jobs superadmin" on public.rating_jobs;
create policy "Rating jobs superadmin"
    on public.rating_jobs
    for all
    to authenticated
    using (
        exists (
            select 1
            from public.user_roles_with_user ur
            where ur.user_id = auth.uid()
              and ur.role_key = 'super_admin'
              and ur.biz_id is null
        )
    )
    with check (
        exists (
            select 1
            from public.user_roles_with_user ur
            where ur.user_id = auth.uid()
              and ur.role_key = 'super_admin'
              and ur.biz_id is null
        )
    );

