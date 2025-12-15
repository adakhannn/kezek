-- Таблица позиций смены (клиенты и суммы по каждому)

create table if not exists public.staff_shift_items (
    id uuid primary key default gen_random_uuid(),
    shift_id uuid not null references public.staff_shifts (id) on delete cascade,
    client_name text,
    service_name text,
    amount numeric(12, 2) not null default 0,
    note text,
    created_at timestamptz not null default timezone('utc'::text, now())
);

comment on table public.staff_shift_items is 'Отдельные операции по клиентам внутри смены сотрудника';

create index if not exists staff_shift_items_shift_idx
    on public.staff_shift_items (shift_id);

alter table public.staff_shift_items enable row level security;

drop policy if exists "Staff shift items own" on public.staff_shift_items;

create policy "Staff shift items own"
    on public.staff_shift_items
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


