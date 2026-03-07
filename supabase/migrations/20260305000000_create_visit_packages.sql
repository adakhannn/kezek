-- Пакеты визитов (абонементы): типы планов, проданные пакеты клиентам, история списаний.
-- См. docs/SUBSCRIPTIONS_AND_PACKAGES_FEATURE.md

-- Тип скидки по пакету
create type public.visit_package_discount_type as enum (
    'percent',       -- скидка в процентах с услуги
    'fixed_price'   -- фиксированная цена за визит
);
comment on type public.visit_package_discount_type is 'Тип применения цены по пакету визитов';

-- Таблица типов пакетов (шаблоны)
create table if not exists public.visit_package_plans (
    id uuid primary key default gen_random_uuid(),
    biz_id uuid not null references public.businesses (id) on delete cascade,

    name_ru text not null,
    name_ky text,
    name_en text,

    visit_count integer not null check (visit_count > 0),
    validity_days integer not null check (validity_days > 0),

    discount_type public.visit_package_discount_type not null,
    discount_value numeric(10, 2) not null check (discount_value >= 0),

    service_id uuid references public.services (id) on delete set null,
    branch_ids uuid[] default null,

    is_active boolean not null default true,
    created_at timestamptz not null default timezone('utc'::text, now()),
    updated_at timestamptz not null default timezone('utc'::text, now())
);

comment on table public.visit_package_plans is 'Типы пакетов визитов (шаблоны) по бизнесу';
comment on column public.visit_package_plans.visit_count is 'Количество визитов в пакете';
comment on column public.visit_package_plans.validity_days is 'Срок действия в днях с момента продажи';
comment on column public.visit_package_plans.discount_type is 'Тип: процент скидки или фиксированная цена за визит';
comment on column public.visit_package_plans.discount_value is 'Процент (0–100) или фиксированная сумма за визит';
comment on column public.visit_package_plans.service_id is 'null = любая услуга';
comment on column public.visit_package_plans.branch_ids is 'Массив id филиалов; пустой или null = все филиалы';

create index if not exists visit_package_plans_biz_id_idx on public.visit_package_plans (biz_id);
create index if not exists visit_package_plans_is_active_idx on public.visit_package_plans (is_active) where is_active = true;

create trigger set_timestamp_visit_package_plans
before update on public.visit_package_plans
for each row
execute function public.set_timestamp_updated_at();

alter table public.visit_package_plans enable row level security;

drop policy if exists "Biz owners/admins/managers can manage visit package plans" on public.visit_package_plans;
create policy "Biz owners/admins/managers can manage visit package plans"
    on public.visit_package_plans
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

-- Таблица проданных пакетов (экземпляры у клиентов)
create table if not exists public.client_visit_packages (
    id uuid primary key default gen_random_uuid(),
    client_id uuid not null references auth.users (id) on delete cascade,
    plan_id uuid not null references public.visit_package_plans (id) on delete restrict,

    remaining_visits integer not null check (remaining_visits >= 0),
    valid_until date not null,
    purchased_at timestamptz not null default timezone('utc'::text, now()),
    created_at timestamptz not null default timezone('utc'::text, now())
);

comment on table public.client_visit_packages is 'Проданные пакеты визитов клиентам';
comment on column public.client_visit_packages.remaining_visits is 'Остаток визитов';
comment on column public.client_visit_packages.valid_until is 'Дата окончания действия пакета';

create index if not exists client_visit_packages_client_valid_idx on public.client_visit_packages (client_id, valid_until);
create index if not exists client_visit_packages_plan_id_idx on public.client_visit_packages (plan_id);

alter table public.client_visit_packages enable row level security;

-- Клиент видит только свои пакеты
drop policy if exists "Clients can view own visit packages" on public.client_visit_packages;
create policy "Clients can view own visit packages"
    on public.client_visit_packages
    for select
    to authenticated
    using (client_id = auth.uid());

-- Владелец/админ/менеджер видит пакеты клиентов своего бизнеса и может создавать записи
drop policy if exists "Biz can manage client visit packages" on public.client_visit_packages;
create policy "Biz can manage client visit packages"
    on public.client_visit_packages
    for all
    to authenticated
    using (
        exists (
            select 1 from public.visit_package_plans p
            where p.id = client_visit_packages.plan_id
              and p.biz_id in (
                  select ur.biz_id from public.user_roles ur
                  join public.roles r on ur.role_id = r.id
                  where ur.user_id = auth.uid() and r.key in ('owner', 'admin', 'manager')
              )
        )
        or is_super_admin()
    )
    with check (
        exists (
            select 1 from public.visit_package_plans p
            where p.id = client_visit_packages.plan_id
              and p.biz_id in (
                  select ur.biz_id from public.user_roles ur
                  join public.roles r on ur.role_id = r.id
                  where ur.user_id = auth.uid() and r.key in ('owner', 'admin', 'manager')
              )
        )
        or is_super_admin()
    );

-- Таблица использований (история списаний визитов)
create table if not exists public.client_visit_package_uses (
    id uuid primary key default gen_random_uuid(),
    client_visit_package_id uuid not null references public.client_visit_packages (id) on delete cascade,
    booking_id uuid not null references public.bookings (id) on delete cascade,
    used_at timestamptz not null default timezone('utc'::text, now())
);

comment on table public.client_visit_package_uses is 'История списаний визитов с пакетов по бронированиям';

create unique index if not exists client_visit_package_uses_booking_id_key on public.client_visit_package_uses (booking_id);
create index if not exists client_visit_package_uses_package_id_idx on public.client_visit_package_uses (client_visit_package_id);

alter table public.client_visit_package_uses enable row level security;

-- Клиент видит использования только своих пакетов
drop policy if exists "Clients can view own visit package uses" on public.client_visit_package_uses;
create policy "Clients can view own visit package uses"
    on public.client_visit_package_uses
    for select
    to authenticated
    using (
        exists (
            select 1 from public.client_visit_packages cvp
            where cvp.id = client_visit_package_uses.client_visit_package_id and cvp.client_id = auth.uid()
        )
    );

-- Дашборд видит использования по своему бизнесу (через пакет -> план -> biz_id)
drop policy if exists "Biz can view visit package uses" on public.client_visit_package_uses;
create policy "Biz can view visit package uses"
    on public.client_visit_package_uses
    for select
    to authenticated
    using (
        exists (
            select 1 from public.client_visit_packages cvp
            join public.visit_package_plans p on p.id = cvp.plan_id
            where cvp.id = client_visit_package_uses.client_visit_package_id
              and p.biz_id in (
                  select ur.biz_id from public.user_roles ur
                  join public.roles r on ur.role_id = r.id
                  where ur.user_id = auth.uid() and r.key in ('owner', 'admin', 'manager')
              )
        )
        or is_super_admin()
    );

-- Поле в bookings для отображения «оплачено пакетом» в UI
alter table public.bookings
add column if not exists subscription_applied jsonb;

comment on column public.bookings.subscription_applied is 'Информация о применённом пакете визитов: plan_id, plan_name, remaining_after, final_amount и т.д.';
