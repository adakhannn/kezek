-- Пер-бизнесовые настройки рейтинга (оверрайд глобального rating_global_config)
-- Миграция не меняет текущую формулу, а только добавляет структуру данных
-- для дальнейшего использования в функциях расчёта рейтинга.

create table if not exists public.rating_biz_config (
    id uuid primary key default gen_random_uuid(),

    biz_id uuid not null references public.businesses (id) on delete cascade,

    -- Необязательный скоуп по категории бизнеса (например, "barbershop").
    -- На первом этапе поле может не использоваться, но оставлено для будущих расширений.
    category_slug text,

    -- Веса для расчёта рейтинга сотрудника (сумма должна быть 100)
    staff_reviews_weight numeric(5, 2) not null,
    staff_productivity_weight numeric(5, 2) not null,
    staff_loyalty_weight numeric(5, 2) not null,
    staff_discipline_weight numeric(5, 2) not null,

    -- Период расчёта (дни) для этого бизнеса
    window_days integer not null,

    -- Активна ли эта конфигурация для данного бизнеса
    is_active boolean not null default true,

    -- Когда конфигурация начала действовать
    valid_from timestamptz not null default timezone('utc'::text, now()),

    created_at timestamptz not null default timezone('utc'::text, now()),
    updated_at timestamptz not null default timezone('utc'::text, now())
);

comment on table public.rating_biz_config is 'Пер-бизнесовые настройки рейтинга (оверрайд глобального rating_global_config)';
comment on column public.rating_biz_config.category_slug is 'Опциональная категория бизнеса для более тонкой настройки формулы рейтинга';
comment on column public.rating_biz_config.window_days is 'Период расчёта рейтинга для этого бизнеса (скользящее окно в днях)';

-- У одного бизнеса может быть несколько исторических конфигов, но только один активный.
create index if not exists rating_biz_config_biz_active_idx
    on public.rating_biz_config (biz_id)
    where is_active = true;

-- Триггер для updated_at (используем уже существующую функцию public.set_timestamp_updated_at)
drop trigger if exists set_timestamp_updated_at_rating_biz_config on public.rating_biz_config;
create trigger set_timestamp_updated_at_rating_biz_config
before update on public.rating_biz_config
for each row
execute function public.set_timestamp_updated_at();

-- Включаем RLS
alter table public.rating_biz_config enable row level security;

-- Политика: владелец бизнеса может читать и изменять только свои строки;
-- суперадмин — управлять любой записью (правила совпадают с rating_global_config).

drop policy if exists "Rating biz config select owners and superadmin" on public.rating_biz_config;
create policy "Rating biz config select owners and superadmin"
    on public.rating_biz_config
    for select
    to authenticated
    using (
        -- Владелец бизнеса
        exists (
            select 1
            from public.businesses b
            where b.id = biz_id
              and b.owner_id = auth.uid()
        )
        or
        -- Суперадмин
        exists (
            select 1
            from public.user_roles_with_user ur
            where ur.user_id = auth.uid()
              and ur.role_key = 'super_admin'
              and ur.biz_id is null
        )
    );

drop policy if exists "Rating biz config modify owners and superadmin" on public.rating_biz_config;
create policy "Rating biz config modify owners and superadmin"
    on public.rating_biz_config
    for all
    to authenticated
    using (
        exists (
            select 1
            from public.businesses b
            where b.id = biz_id
              and b.owner_id = auth.uid()
        )
        or
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
            from public.businesses b
            where b.id = biz_id
              and b.owner_id = auth.uid()
        )
        or
        exists (
            select 1
            from public.user_roles_with_user ur
            where ur.user_id = auth.uid()
              and ur.role_key = 'super_admin'
              and ur.biz_id is null
        )
    );

