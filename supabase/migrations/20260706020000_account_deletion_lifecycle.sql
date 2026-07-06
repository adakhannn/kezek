create table if not exists public.account_deletion_requests (
    user_id uuid primary key,
    status text not null default 'pending' check (status in ('pending', 'cancelled', 'completed', 'blocked')),
    requested_at timestamptz not null default now(),
    scheduled_for timestamptz not null,
    cancelled_at timestamptz,
    completed_at timestamptz,
    blocker_snapshot jsonb not null default '[]'::jsonb,
    preference_snapshot jsonb not null default '{}'::jsonb,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

alter table public.account_deletion_requests enable row level security;
revoke all on public.account_deletion_requests from anon, authenticated;
grant all on public.account_deletion_requests to service_role;

create index if not exists account_deletion_requests_due_idx
    on public.account_deletion_requests (scheduled_for)
    where status = 'pending';

create or replace function public.finalize_due_account_deletions(batch_limit integer default 50)
returns integer
language plpgsql
security definer
set search_path = public, auth
as $$
declare
    request_row record;
    completed_count integer := 0;
    has_blocker boolean;
begin
    for request_row in
        select user_id
        from public.account_deletion_requests
        where status = 'pending' and scheduled_for <= now()
        order by scheduled_for
        limit greatest(1, least(batch_limit, 200))
        for update skip locked
    loop
        select
            exists(select 1 from public.businesses where owner_id = request_row.user_id)
            or exists(select 1 from public.staff where user_id = request_row.user_id)
            or exists(select 1 from public.user_roles where user_id = request_row.user_id)
            or exists(select 1 from public.user_global_roles where user_id = request_row.user_id)
            or exists(select 1 from public.super_admins_legacy where user_id = request_row.user_id)
            or exists(
                select 1 from public.bookings
                where client_id = request_row.user_id
                  and status in ('hold', 'confirmed', 'paid')
                  and start_at >= now()
            )
        into has_blocker;

        if has_blocker then
            update public.account_deletion_requests
            set status = 'blocked', updated_at = now()
            where user_id = request_row.user_id;
            continue;
        end if;

        delete from public.reviews where client_id = request_row.user_id;
        update public.bookings
        set client_id = null,
            client_name = 'Удалённый пользователь',
            client_email = null,
            client_phone = null
        where client_id = request_row.user_id;

        delete from public.user_current_business where user_id = request_row.user_id;
        delete from public.profiles where id = request_row.user_id;
        delete from auth.users where id = request_row.user_id;

        update public.account_deletion_requests
        set status = 'completed', completed_at = now(), updated_at = now()
        where user_id = request_row.user_id;
        completed_count := completed_count + 1;
    end loop;

    return completed_count;
end;
$$;

revoke all on function public.finalize_due_account_deletions(integer) from public, anon, authenticated;
grant execute on function public.finalize_due_account_deletions(integer) to service_role;
