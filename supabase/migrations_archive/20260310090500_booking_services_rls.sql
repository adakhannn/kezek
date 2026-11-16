-- RLS и политики доступа для booking_services.
-- Наследуем правила от таблицы bookings по связке booking_services.booking_id -> bookings.id.

alter table public.booking_services enable row level security;

-- На всякий случай очищаем старые политики, если миграция пере-применяется вручную.
drop policy if exists "Clients can view own booking_services" on public.booking_services;
drop policy if exists "Business owners can view booking_services" on public.booking_services;
drop policy if exists "Staff can view booking_services" on public.booking_services;
drop policy if exists "Super admins can manage all booking_services" on public.booking_services;

-- Клиенты видят только состав услуг своих бронирований (по client_id или client_phone, как в bookings).
create policy "Clients can view own booking_services"
    on public.booking_services
    for select
    to authenticated
    using (
        exists (
            select 1
            from public.bookings b
            where b.id = booking_services.booking_id
              and (
                  b.client_id = auth.uid()
                  or (
                      b.client_phone is not null
                      and exists (
                          select 1
                          from public.profiles p
                          where p.id = auth.uid()
                            and p.phone = b.client_phone
                      )
                  )
              )
        )
    );

-- Владельцы/админы/менеджеры видят состав услуг бронирований своих бизнесов.
create policy "Business owners can view booking_services"
    on public.booking_services
    for select
    to authenticated
    using (
        exists (
            select 1
            from public.bookings b
            where b.id = booking_services.booking_id
              and (
                  b.biz_id in (
                      select ur.biz_id
                      from public.user_roles ur
                      join public.roles r on ur.role_id = r.id
                      where ur.user_id = auth.uid()
                        and r.key in ('owner', 'admin', 'manager')
                  )
                  or is_super_admin()
              )
        )
    );

-- Сотрудники видят состав услуг по бронированиям, где они назначены.
create policy "Staff can view booking_services"
    on public.booking_services
    for select
    to authenticated
    using (
        exists (
            select 1
            from public.bookings b
            join public.staff s on s.id = b.staff_id
            where b.id = booking_services.booking_id
              and s.user_id = auth.uid()
              and s.is_active = true
        )
    );

-- Суперадмины могут выполнять любые операции с booking_services.
create policy "Super admins can manage all booking_services"
    on public.booking_services
    for all
    to authenticated
    using (is_super_admin())
    with check (is_super_admin());

