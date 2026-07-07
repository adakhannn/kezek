alter table public.businesses
    add column if not exists branch_limit integer;

update public.businesses as business
set branch_limit = greatest(
    1,
    (select count(*)::integer from public.branches as branch where branch.biz_id = business.id)
)
where branch_limit is null;

alter table public.businesses
    alter column branch_limit set default 1,
    alter column branch_limit set not null;

alter table public.businesses
    drop constraint if exists businesses_branch_limit_positive;

alter table public.businesses
    add constraint businesses_branch_limit_positive check (branch_limit >= 1);

create or replace function public.enforce_business_branch_limit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
    allowed_count integer;
    current_count integer;
begin
    select branch_limit
    into allowed_count
    from public.businesses
    where id = new.biz_id
    for update;

    if allowed_count is null then
        raise exception using errcode = '23503', message = 'BUSINESS_NOT_FOUND';
    end if;

    select count(*)::integer
    into current_count
    from public.branches
    where biz_id = new.biz_id;

    if current_count >= allowed_count then
        raise exception using
            errcode = 'P0001',
            message = format('BRANCH_LIMIT_REACHED:%s:%s', current_count, allowed_count);
    end if;

    return new;
end;
$$;

drop trigger if exists branches_enforce_business_limit on public.branches;
create trigger branches_enforce_business_limit
before insert on public.branches
for each row execute function public.enforce_business_branch_limit();

comment on column public.businesses.branch_limit is
    'Maximum number of branches allowed for the business. Existing businesses were initialized to max(current branch count, 1).';
