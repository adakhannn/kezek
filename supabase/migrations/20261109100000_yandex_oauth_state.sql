-- OAuth attempts are server-owned; a state can be consumed once, across all workers.
create table public.yandex_oauth_states (
    state_hash text primary key check (state_hash ~ '^[a-f0-9]{64}$'),
    flow text not null check (flow in ('sign_in', 'link')),
    user_id uuid references auth.users(id) on delete cascade,
    return_path text not null default '/',
    expires_at timestamptz not null default (now() + interval '10 minutes'),
    check ((flow = 'link' and user_id is not null) or (flow = 'sign_in' and user_id is null))
);
create index yandex_oauth_states_expiry_idx on public.yandex_oauth_states (expires_at);
alter table public.yandex_oauth_states enable row level security;
revoke all on public.yandex_oauth_states from public, anon, authenticated;
grant all on public.yandex_oauth_states to service_role;

create function public.create_yandex_oauth_state(
    p_state_hash text, p_flow text, p_user_id uuid, p_return_path text
) returns void
language plpgsql security definer set search_path = ''
as $$
begin
    -- Bounded maintenance: expired records never authorize a callback.
    delete from public.yandex_oauth_states where state_hash in (
        select state_hash from public.yandex_oauth_states
        where expires_at <= now() order by expires_at limit 500
    );
    insert into public.yandex_oauth_states (state_hash, flow, user_id, return_path)
    values (p_state_hash, p_flow, p_user_id, p_return_path);
end;
$$;

create function public.consume_yandex_oauth_state(
    p_state_hash text, p_flow text, p_user_id uuid
) returns jsonb
language sql security definer set search_path = ''
as $$
    with consumed as (
        delete from public.yandex_oauth_states
        where state_hash = p_state_hash
          and flow = p_flow
          and user_id is not distinct from p_user_id
          and expires_at > now()
        returning flow, user_id, return_path
    )
    select jsonb_build_object('flow', flow, 'user_id', user_id, 'return_path', return_path)
    from consumed;
$$;

revoke all on function public.create_yandex_oauth_state(text, text, uuid, text) from public, anon, authenticated;
revoke all on function public.consume_yandex_oauth_state(text, text, uuid) from public, anon, authenticated;
grant execute on function public.create_yandex_oauth_state(text, text, uuid, text) to service_role;
grant execute on function public.consume_yandex_oauth_state(text, text, uuid) to service_role;
