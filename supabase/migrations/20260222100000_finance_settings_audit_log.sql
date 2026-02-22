-- Журнал изменений финансовых настроек (кто, когда, какие поля)
-- Задача 6.2.1 EVOLUTION_TECH_PLAN: человекочитаемый audit-trail поверх логов операций

create table if not exists public.finance_settings_audit_log (
    id uuid primary key default gen_random_uuid(),
    biz_id uuid not null references public.businesses (id) on delete cascade,
    staff_id uuid not null references public.staff (id) on delete cascade,
    changed_by_user_id uuid references auth.users (id) on delete set null,
    changed_at timestamptz not null default timezone('utc'::text, now()),
    -- Короткий diff: массив { "field": "percent_master", "old_value": 60, "new_value": 70 }
    field_changes jsonb not null default '[]'::jsonb,
    -- Человекочитаемое краткое сообщение (опционально)
    message text,
    constraint field_changes_array check (jsonb_typeof(field_changes) = 'array')
);

comment on table public.finance_settings_audit_log is 'Журнал изменений финансовых настроек сотрудника (проценты, ставка). Для владельческого UI при просмотре смен/финансов.';
comment on column public.finance_settings_audit_log.field_changes is 'Массив объектов: { "field": "percent_master"|"percent_salon"|"hourly_rate", "old_value": number|null, "new_value": number|null }';

create index if not exists finance_settings_audit_log_staff_created_idx
    on public.finance_settings_audit_log (staff_id, changed_at desc);
create index if not exists finance_settings_audit_log_biz_created_idx
    on public.finance_settings_audit_log (biz_id, changed_at desc);

alter table public.finance_settings_audit_log enable row level security;

-- Менеджеры/владельцы бизнеса видят только записи своего бизнеса
create policy "Managers can view audit log for their biz"
    on public.finance_settings_audit_log
    for select
    to authenticated
    using (
        exists (
            select 1 from public.user_roles_with_user ur
            where ur.user_id = auth.uid()
              and ur.biz_id = finance_settings_audit_log.biz_id
              and ur.role_key in ('owner', 'manager')
        )
    );

-- Вставка только через service_role (из API после проверки прав)
-- RLS не разрешает insert для authenticated; API использует getServiceClient()
