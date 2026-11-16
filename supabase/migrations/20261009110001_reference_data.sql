-- Reference rows the application requires in every environment.
-- The production baseline is schema-only; production already has these rows,
-- so every statement here is idempotent and leaves existing rows untouched.

insert into public.roles (key, name, description, is_system, scope)
values
    ('owner', 'Владелец', 'Владелец бизнеса', true, 'business'),
    ('admin', 'Администратор', 'Администратор бизнеса', true, 'business'),
    ('manager', 'Менеджер', 'Менеджер бизнеса', true, 'business'),
    ('staff', 'Сотрудник', 'Сотрудник бизнеса', true, 'business'),
    ('client', 'Клиент', 'Клиент', true, 'business'),
    ('super_admin', 'Супер-администратор', 'Администратор платформы', true, 'platform')
on conflict (key) do nothing;

-- Rating functions raise "No active rating configuration found" without it.
insert into public.rating_global_config (is_active, valid_from)
select true, timezone('utc'::text, now())
where not exists (select 1 from public.rating_global_config where is_active);
