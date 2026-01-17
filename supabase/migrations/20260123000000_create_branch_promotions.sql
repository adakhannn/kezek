-- Миграция для системы акций филиалов
-- Типы акций:
-- 1. free_after_n_visits - N-я услуга бесплатно (например, 7-я стрижка бесплатно)
-- 2. referral_free - Приведи друга - получи услугу бесплатно
-- 3. referral_discount_50 - Приведи друга - получи скидку 50%
-- 4. birthday_discount - Скидка в день рождения
-- 5. first_visit_discount - Скидка за первый визит

-- Тип акции
create type public.promotion_type as enum (
    'free_after_n_visits',  -- N-я услуга бесплатно
    'referral_free',        -- Приведи друга - получи услугу бесплатно
    'referral_discount_50', -- Приведи друга - получи скидку 50%
    'birthday_discount',    -- Скидка в день рождения
    'first_visit_discount'  -- Скидка за первый визит
);

comment on type public.promotion_type is 'Тип акции филиала';

-- Таблица акций филиалов
create table if not exists public.branch_promotions (
    id uuid primary key default gen_random_uuid(),
    branch_id uuid not null references public.branches (id) on delete cascade,
    biz_id uuid not null references public.businesses (id) on delete cascade,
    
    -- Тип акции
    promotion_type public.promotion_type not null,
    
    -- Параметры акции (JSONB для гибкости)
    -- Для free_after_n_visits: {"visit_count": 7} - каждая 7-я услуга бесплатно
    -- Для referral_free: {} - без параметров
    -- Для referral_discount_50: {} - без параметров
    -- Для birthday_discount: {"discount_percent": 20} - скидка в процентах
    -- Для first_visit_discount: {"discount_percent": 15} - скидка в процентах
    params jsonb not null default '{}'::jsonb,
    
    -- Название акции (для отображения)
    title_ru text not null,
    title_ky text,
    title_en text,
    
    -- Описание акции (для отображения)
    description_ru text,
    description_ky text,
    description_en text,
    
    -- Активна ли акция
    is_active boolean not null default true,
    
    -- Дата начала и окончания акции (опционально)
    valid_from date,
    valid_to date,
    
    created_at timestamptz not null default timezone('utc'::text, now()),
    updated_at timestamptz not null default timezone('utc'::text, now())
);

comment on table public.branch_promotions is 'Акции филиалов';
comment on column public.branch_promotions.promotion_type is 'Тип акции';
comment on column public.branch_promotions.params is 'Параметры акции в формате JSON';
comment on column public.branch_promotions.title_ru is 'Название акции (русский)';
comment on column public.branch_promotions.title_ky is 'Название акции (кыргызский)';
comment on column public.branch_promotions.title_en is 'Название акции (английский)';
comment on column public.branch_promotions.is_active is 'Активна ли акция';
comment on column public.branch_promotions.valid_from is 'Дата начала действия акции (null = без ограничений)';
comment on column public.branch_promotions.valid_to is 'Дата окончания действия акции (null = без ограничений)';

-- Индексы
create index if not exists branch_promotions_branch_id_idx on public.branch_promotions (branch_id);
create index if not exists branch_promotions_biz_id_idx on public.branch_promotions (biz_id);
create index if not exists branch_promotions_is_active_idx on public.branch_promotions (is_active) where is_active = true;
create index if not exists branch_promotions_type_idx on public.branch_promotions (promotion_type);

-- Триггер для автоматического обновления updated_at
create trigger set_timestamp_updated_at
before update on public.branch_promotions
for each row
execute function public.set_timestamp_updated_at();

-- RLS для branch_promotions
alter table public.branch_promotions enable row level security;

-- Владелец/админ/менеджер бизнеса может читать и изменять акции своих филиалов
drop policy if exists "Biz owners/admins/managers can manage branch promotions" on public.branch_promotions;
create policy "Biz owners/admins/managers can manage branch promotions"
    on public.branch_promotions
    for all
    to authenticated
    using (
        biz_id in (
            select ur.biz_id 
            from public.user_roles ur
            join public.roles r on ur.role_id = r.id
            where ur.user_id = auth.uid() 
              and r.key in ('owner', 'admin', 'manager')
        )
        or is_super_admin()
    )
    with check (
        biz_id in (
            select ur.biz_id 
            from public.user_roles ur
            join public.roles r on ur.role_id = r.id
            where ur.user_id = auth.uid() 
              and r.key in ('owner', 'admin', 'manager')
        )
        or is_super_admin()
    );

-- Публичный доступ на чтение для активных акций
drop policy if exists "Public can view active branch promotions" on public.branch_promotions;
create policy "Public can view active branch promotions"
    on public.branch_promotions
    for select
    to anon, authenticated
    using (
        is_active = true
        and (valid_from is null or valid_from <= CURRENT_DATE)
        and (valid_to is null or valid_to >= CURRENT_DATE)
    );

-- Таблица для отслеживания использования акций клиентами
create table if not exists public.client_promotion_usage (
    id uuid primary key default gen_random_uuid(),
    client_id uuid not null references auth.users (id) on delete cascade,
    branch_id uuid not null references public.branches (id) on delete cascade,
    biz_id uuid not null references public.businesses (id) on delete cascade,
    promotion_id uuid not null references public.branch_promotions (id) on delete cascade,
    
    -- Тип акции (для быстрого поиска)
    promotion_type public.promotion_type not null,
    
    -- Бронирование, при котором использовалась акция
    booking_id uuid references public.bookings (id) on delete set null,
    
    -- Параметры использования (например, счетчик посещений для free_after_n_visits)
    usage_data jsonb not null default '{}'::jsonb,
    
    -- Дата использования
    used_at timestamptz not null default timezone('utc'::text, now()),
    
    created_at timestamptz not null default timezone('utc'::text, now())
);

comment on table public.client_promotion_usage is 'История использования акций клиентами';
comment on column public.client_promotion_usage.usage_data is 'Дополнительные данные использования (например, {"visit_count": 7} для free_after_n_visits)';
comment on column public.client_promotion_usage.promotion_type is 'Тип акции (дублируется для быстрого поиска)';

-- Индексы для client_promotion_usage
create index if not exists client_promotion_usage_client_branch_idx on public.client_promotion_usage (client_id, branch_id);
create index if not exists client_promotion_usage_promotion_idx on public.client_promotion_usage (promotion_id);
create index if not exists client_promotion_usage_booking_idx on public.client_promotion_usage (booking_id);
create index if not exists client_promotion_usage_type_idx on public.client_promotion_usage (promotion_type);

-- RLS для client_promotion_usage
alter table public.client_promotion_usage enable row level security;

-- Клиент может читать свою историю использования акций
drop policy if exists "Clients can view own promotion usage" on public.client_promotion_usage;
create policy "Clients can view own promotion usage"
    on public.client_promotion_usage
    for select
    to authenticated
    using (client_id = auth.uid());

-- Владелец/админ/менеджер бизнеса может читать использование акций своих клиентов
drop policy if exists "Biz owners/admins/managers can view promotion usage" on public.client_promotion_usage;
create policy "Biz owners/admins/managers can view promotion usage"
    on public.client_promotion_usage
    for select
    to authenticated
    using (
        biz_id in (
            select ur.biz_id 
            from public.user_roles ur
            join public.roles r on ur.role_id = r.id
            where ur.user_id = auth.uid() 
              and r.key in ('owner', 'admin', 'manager')
        )
        or is_super_admin()
    );

-- Таблица для отслеживания реферальных связей (для referral_free и referral_discount_50)
create table if not exists public.client_referrals (
    id uuid primary key default gen_random_uuid(),
    referrer_id uuid not null references auth.users (id) on delete cascade, -- Тот, кто привел
    referred_id uuid not null references auth.users (id) on delete cascade, -- Тот, кого привели
    branch_id uuid not null references public.branches (id) on delete cascade,
    biz_id uuid not null references public.businesses (id) on delete cascade,
    
    -- Бронирование реферера, при котором он получил бонус
    referrer_booking_id uuid references public.bookings (id) on delete set null,
    
    -- Бронирование реферала, за которое реферер получил бонус
    referred_booking_id uuid references public.bookings (id) on delete set null,
    
    -- Использован ли бонус реферером
    referrer_bonus_used boolean not null default false,
    
    created_at timestamptz not null default timezone('utc'::text, now())
);

comment on table public.client_referrals is 'Реферальные связи между клиентами';

-- Индексы для client_referrals
create index if not exists client_referrals_referrer_idx on public.client_referrals (referrer_id);
create index if not exists client_referrals_referred_idx on public.client_referrals (referred_id);
create index if not exists client_referrals_branch_idx on public.client_referrals (branch_id);

-- Уникальность: один реферал может быть привязан к одному рефереру в рамках одного филиала
create unique index if not exists client_referrals_unique_idx on public.client_referrals (referred_id, branch_id);

-- RLS для client_referrals
alter table public.client_referrals enable row level security;

-- Клиент может читать свои реферальные связи (как реферер, так и реферал)
drop policy if exists "Clients can view own referrals" on public.client_referrals;
create policy "Clients can view own referrals"
    on public.client_referrals
    for select
    to authenticated
    using (referrer_id = auth.uid() or referred_id = auth.uid());

-- Владелец/админ/менеджер бизнеса может читать реферальные связи своих клиентов
drop policy if exists "Biz owners/admins/managers can view referrals" on public.client_referrals;
create policy "Biz owners/admins/managers can view referrals"
    on public.client_referrals
    for select
    to authenticated
    using (
        biz_id in (
            select ur.biz_id 
            from public.user_roles ur
            join public.roles r on ur.role_id = r.id
            where ur.user_id = auth.uid() 
              and r.key in ('owner', 'admin', 'manager')
        )
        or is_super_admin()
    );

-- Функция для получения количества посещений клиента в филиале (для free_after_n_visits)
create or replace function public.get_client_visit_count(p_client_id uuid, p_branch_id uuid)
returns integer
language plpgsql
security definer
as $$
declare
    v_count integer;
begin
    -- Считаем только завершенные (paid) бронирования в этом филиале
    select count(*)::integer
    into v_count
    from public.bookings
    where client_id = p_client_id
      and branch_id = p_branch_id
      and status = 'paid'
      and end_at < now();
    
    return coalesce(v_count, 0);
end;
$$;

comment on function public.get_client_visit_count(uuid, uuid) is 'Возвращает количество посещений клиента в филиале';

-- Функция для проверки, может ли клиент использовать акцию при бронировании
create or replace function public.can_use_promotion(
    p_client_id uuid,
    p_branch_id uuid,
    p_promotion_id uuid
)
returns boolean
language plpgsql
security definer
as $$
declare
    v_promotion public.branch_promotions;
    v_visit_count integer;
    v_has_referral boolean;
    v_is_first_visit boolean;
    v_today_birthday boolean;
begin
    -- Получаем акцию
    select * into v_promotion
    from public.branch_promotions
    where id = p_promotion_id
      and branch_id = p_branch_id
      and is_active = true
      and (valid_from is null or valid_from <= CURRENT_DATE)
      and (valid_to is null or valid_to >= CURRENT_DATE);
    
    if v_promotion is null then
        return false; -- Акция не найдена или неактивна
    end if;
    
    -- Проверяем по типу акции
    case v_promotion.promotion_type
        when 'free_after_n_visits' then
            -- Для free_after_n_visits: проверяем, что текущее количество посещений кратно N-1
            -- Например, для 7-й услуги бесплатно: visit_count должно быть 6, 13, 20, и т.д.
            v_visit_count := public.get_client_visit_count(p_client_id, p_branch_id);
            declare
                v_n integer := (v_promotion.params->>'visit_count')::integer;
            begin
                if v_n is null or v_n < 1 then
                    return false;
                end if;
                -- Проверяем, что следующее посещение будет N-м (например, 7-м)
                return (v_visit_count + 1) % v_n = 0;
            end;
            
        when 'referral_free', 'referral_discount_50' then
            -- Для реферальных акций: проверяем, что у клиента есть неиспользованный бонус
            select exists (
                select 1
                from public.client_referrals
                where referrer_id = p_client_id
                  and branch_id = p_branch_id
                  and referrer_bonus_used = false
            ) into v_has_referral;
            return v_has_referral;
            
        when 'first_visit_discount' then
            -- Для скидки за первый визит: проверяем, что это первый визит в этот филиал
            v_visit_count := public.get_client_visit_count(p_client_id, p_branch_id);
            return v_visit_count = 0;
            
        when 'birthday_discount' then
            -- Для скидки в день рождения: проверяем, что сегодня день рождения клиента
            -- TODO: Нужно добавить поле birthday в profiles или clients
            -- Пока возвращаем false
            return false;
            
        else
            return false;
    end case;
end;
$$;

comment on function public.can_use_promotion(uuid, uuid, uuid) is 'Проверяет, может ли клиент использовать акцию при бронировании';

