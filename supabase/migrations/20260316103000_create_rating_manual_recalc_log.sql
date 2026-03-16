-- Лог ручных перезапусков пересчёта рейтингов

create table if not exists public.rating_manual_recalc_log (
    id uuid primary key default gen_random_uuid(),
    created_at timestamptz not null default timezone('utc'::text, now()),
    user_id uuid,
    entity_type text not null, -- 'staff' | 'branch' | 'biz'
    entity_id uuid not null,
    date_from date,
    date_to date,
    action text not null, -- 'recalculate_metrics' | 'recalculate_rating'
    status text not null, -- 'success' | 'error'
    error_message text
);

comment on table public.rating_manual_recalc_log is 'Лог ручных перезапусков пересчёта рейтингов из админки';

alter table public.rating_manual_recalc_log enable row level security;

-- Только суперадмины могут читать/создавать записи лога
drop policy if exists "Rating manual recalc log superadmin" on public.rating_manual_recalc_log;
create policy "Rating manual recalc log superadmin"
    on public.rating_manual_recalc_log
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

