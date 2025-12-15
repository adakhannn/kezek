-- Создаём таблицы для учёта смен сотрудников и финансовых показателей

-- Таблица смен сотрудника
create table if not exists public.staff_shifts (
    id uuid primary key default gen_random_uuid(),
    staff_id uuid not null references public.staff (id) on delete cascade,
    biz_id uuid not null references public.businesses (id) on delete cascade,
    branch_id uuid not null references public.branches (id) on delete cascade,

    -- Дата смены в локальной TZ (без времени)
    shift_date date not null,

    -- Время открытия / закрытия смены
    opened_at timestamptz,
    closed_at timestamptz,

    -- Ожидаемое время начала смены (по расписанию) и минуты опоздания
    expected_start timestamptz,
    late_minutes integer not null default 0,

    -- Финансовые показатели
    total_amount numeric(12, 2) not null default 0,          -- выручка за все услуги за день
    consumables_amount numeric(12, 2) not null default 0,    -- сумма расходников
    master_share numeric(12, 2) not null default 0,          -- доля мастера
    salon_share numeric(12, 2) not null default 0,           -- доля салона

    -- Проценты распределения
    percent_master numeric(5, 2) not null default 60,
    percent_salon numeric(5, 2) not null default 40,

    status text not null default 'open' check (status in ('open', 'closed')),

    created_at timestamptz not null default timezone('utc'::text, now()),
    updated_at timestamptz not null default timezone('utc'::text, now())
);

comment on table public.staff_shifts is 'Смены сотрудников с финансовыми показателями';

create index if not exists staff_shifts_staff_date_idx
    on public.staff_shifts (staff_id, shift_date);

-- Триггер для автоматического обновления updated_at
create or replace function public.set_timestamp_updated_at()
returns trigger as $$
begin
    new.updated_at = timezone('utc'::text, now());
    return new;
end;
$$ language plpgsql;

drop trigger if exists set_timestamp_updated_at on public.staff_shifts;
create trigger set_timestamp_updated_at
before update on public.staff_shifts
for each row
execute function public.set_timestamp_updated_at();

-- Таблица расходов внутри смены (опционально, пока может не использоваться в интерфейсе)
create table if not exists public.staff_shift_expenses (
    id uuid primary key default gen_random_uuid(),
    shift_id uuid not null references public.staff_shifts (id) on delete cascade,
    title text not null,
    amount numeric(12, 2) not null default 0,
    created_at timestamptz not null default timezone('utc'::text, now())
);

comment on table public.staff_shift_expenses is 'Расходы (расходники и прочее) по сменам сотрудников';

create index if not exists staff_shift_expenses_shift_idx
    on public.staff_shift_expenses (shift_id);

-- Включаем RLS и настраиваем базовые политики:
-- сотрудник может работать только со своими сменами.
alter table public.staff_shifts enable row level security;
alter table public.staff_shift_expenses enable row level security;

-- Политики для staff_shifts
drop policy if exists "Staff shifts select own" on public.staff_shifts;
drop policy if exists "Staff shifts modify own" on public.staff_shifts;

create policy "Staff shifts select own"
    on public.staff_shifts
    for select
    to authenticated
    using (
        exists (
            select 1
            from public.staff s
            where s.id = staff_id
              and s.user_id = auth.uid()
              and s.is_active = true
        )
    );

create policy "Staff shifts modify own"
    on public.staff_shifts
    for all
    to authenticated
    using (
        exists (
            select 1
            from public.staff s
            where s.id = staff_id
              and s.user_id = auth.uid()
              and s.is_active = true
        )
    )
    with check (
        exists (
            select 1
            from public.staff s
            where s.id = staff_id
              and s.user_id = auth.uid()
              and s.is_active = true
        )
    );

-- Политики для staff_shift_expenses
drop policy if exists "Staff shift expenses own" on public.staff_shift_expenses;

create policy "Staff shift expenses own"
    on public.staff_shift_expenses
    for all
    to authenticated
    using (
        exists (
            select 1
            from public.staff_shifts sh
            join public.staff s on s.id = sh.staff_id
            where sh.id = shift_id
              and s.user_id = auth.uid()
              and s.is_active = true
        )
    )
    with check (
        exists (
            select 1
            from public.staff_shifts sh
            join public.staff s on s.id = sh.staff_id
            where sh.id = shift_id
              and s.user_id = auth.uid()
              and s.is_active = true
        )
    );


