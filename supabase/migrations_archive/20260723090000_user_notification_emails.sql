create table if not exists public.user_notification_emails (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references auth.users(id) on delete cascade,
    email text not null,
    verified boolean not null default true,
    enabled boolean not null default false,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    constraint user_notification_emails_normalized
        check (email = lower(btrim(email))),
    constraint user_notification_emails_unique
        unique (user_id, email)
);

create table if not exists public.user_notification_email_sources (
    email_id uuid not null references public.user_notification_emails(id) on delete cascade,
    source text not null check (source in ('account', 'google', 'yandex')),
    provider_subject text,
    created_at timestamptz not null default now(),
    primary key (email_id, source)
);

create index if not exists user_notification_emails_user_enabled_idx
    on public.user_notification_emails(user_id, enabled)
    where verified;

alter table public.user_notification_emails enable row level security;
alter table public.user_notification_email_sources enable row level security;

drop policy if exists "Users can view own notification emails"
    on public.user_notification_emails;
create policy "Users can view own notification emails"
    on public.user_notification_emails
    for select
    to authenticated
    using (user_id = auth.uid());

drop policy if exists "Users can view own notification email sources"
    on public.user_notification_email_sources;
create policy "Users can view own notification email sources"
    on public.user_notification_email_sources
    for select
    to authenticated
    using (
        exists (
            select 1
            from public.user_notification_emails email
            where email.id = email_id
              and email.user_id = auth.uid()
        )
    );

revoke insert, update, delete on public.user_notification_emails from anon, authenticated;
revoke insert, update, delete on public.user_notification_email_sources from anon, authenticated;
grant select on public.user_notification_emails to authenticated;
grant select on public.user_notification_email_sources to authenticated;

create or replace function public.sync_user_notification_email(
    target_user_id uuid,
    target_email text,
    target_source text,
    target_provider_subject text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
    normalized_email text := lower(btrim(target_email));
    notification_email_id uuid;
    should_enable boolean;
begin
    if target_source not in ('account', 'google', 'yandex') then
        raise exception 'Unsupported notification email source';
    end if;
    if normalized_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then
        raise exception 'Invalid notification email';
    end if;

    select not exists (
        select 1
        from public.user_notification_emails
        where user_id = target_user_id
    ) into should_enable;

    insert into public.user_notification_emails(user_id, email, verified, enabled)
    values (target_user_id, normalized_email, true, should_enable)
    on conflict (user_id, email) do update
    set verified = true,
        updated_at = now()
    returning id into notification_email_id;

    insert into public.user_notification_email_sources(
        email_id,
        source,
        provider_subject
    )
    values (
        notification_email_id,
        target_source,
        target_provider_subject
    )
    on conflict (email_id, source) do update
    set provider_subject = excluded.provider_subject;
end;
$$;

create or replace function public.remove_user_notification_email_source(
    target_user_id uuid,
    target_source text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
    delete from public.user_notification_email_sources source
    using public.user_notification_emails email
    where source.email_id = email.id
      and email.user_id = target_user_id
      and source.source = target_source;

    delete from public.user_notification_emails email
    where email.user_id = target_user_id
      and not exists (
          select 1
          from public.user_notification_email_sources source
          where source.email_id = email.id
      );

    if not exists (
        select 1
        from public.user_notification_emails
        where user_id = target_user_id
          and enabled
          and verified
    ) then
        update public.user_notification_emails
        set enabled = true,
            updated_at = now()
        where id = (
            select id
            from public.user_notification_emails
            where user_id = target_user_id
              and verified
            order by created_at
            limit 1
        );
    end if;
end;
$$;

create or replace function public.get_my_notification_emails()
returns table (
    email text,
    verified boolean,
    enabled boolean,
    sources text[]
)
language sql
security definer
stable
set search_path = public
as $$
    select
        email.email,
        email.verified,
        email.enabled,
        coalesce(array_agg(source.source order by source.source), array[]::text[]) as sources
    from public.user_notification_emails email
    left join public.user_notification_email_sources source
        on source.email_id = email.id
    where email.user_id = auth.uid()
    group by email.id
    order by email.created_at, email.email;
$$;

create or replace function public.set_my_notification_email_preferences(
    target_enabled boolean,
    target_emails text[]
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
    normalized_emails text[] := coalesce(
        (
            select array_agg(distinct lower(btrim(value)))
            from unnest(coalesce(target_emails, array[]::text[])) value
            where btrim(value) <> ''
        ),
        array[]::text[]
    );
begin
    if auth.uid() is null then
        raise exception 'Authentication required';
    end if;
    if target_enabled and cardinality(normalized_emails) = 0 then
        raise exception 'Select at least one notification email';
    end if;
    if exists (
        select 1
        from unnest(normalized_emails) selected_email
        where not exists (
            select 1
            from public.user_notification_emails email
            where email.user_id = auth.uid()
              and email.email = selected_email
              and email.verified
        )
    ) then
        raise exception 'Unknown or unverified notification email';
    end if;

    update public.user_notification_emails
    set enabled = email = any(normalized_emails),
        updated_at = now()
    where user_id = auth.uid();

    update public.profiles
    set notify_email = target_enabled
    where id = auth.uid();
end;
$$;

revoke all on function public.sync_user_notification_email(uuid, text, text, text) from public;
revoke all on function public.remove_user_notification_email_source(uuid, text) from public;
grant execute on function public.sync_user_notification_email(uuid, text, text, text) to service_role;
grant execute on function public.remove_user_notification_email_source(uuid, text) to service_role;

revoke all on function public.get_my_notification_emails() from public;
revoke all on function public.set_my_notification_email_preferences(boolean, text[]) from public;
grant execute on function public.get_my_notification_emails() to authenticated;
grant execute on function public.set_my_notification_email_preferences(boolean, text[]) to authenticated;

create or replace function public.sync_auth_user_notification_email()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
    if tg_op = 'UPDATE' and old.email is distinct from new.email then
        perform public.remove_user_notification_email_source(new.id, 'account');
    end if;

    if new.email is not null and new.email_confirmed_at is not null then
        perform public.sync_user_notification_email(new.id, new.email, 'account', new.id::text);
    end if;
    return new;
end;
$$;

drop trigger if exists sync_auth_user_notification_email_trigger on auth.users;
create trigger sync_auth_user_notification_email_trigger
after insert or update of email, email_confirmed_at on auth.users
for each row execute function public.sync_auth_user_notification_email();

select public.sync_user_notification_email(
    user_row.id,
    user_row.email,
    'account',
    user_row.id::text
)
from auth.users user_row
where user_row.email is not null
  and user_row.email_confirmed_at is not null;
