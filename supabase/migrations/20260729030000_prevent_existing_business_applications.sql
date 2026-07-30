create index if not exists businesses_normalized_name_idx
    on public.businesses (
        (lower(regexp_replace(btrim(name), '[[:space:]]+', ' ', 'g')))
    );

create or replace function public.prevent_application_for_existing_business()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
    if exists (
        select 1
        from public.businesses b
        where lower(regexp_replace(btrim(b.name), '[[:space:]]+', ' ', 'g'))
            = lower(regexp_replace(btrim(new.business_name), '[[:space:]]+', ' ', 'g'))
    ) then
        raise exception using
            errcode = 'P0001',
            message = 'APPLICATION_POLICY:business_exists';
    end if;

    return new;
end;
$$;

drop trigger if exists prevent_existing_business_application
    on public.business_registration_applications;

create trigger prevent_existing_business_application
before insert or update of business_name
on public.business_registration_applications
for each row
execute function public.prevent_application_for_existing_business();

comment on function public.prevent_application_for_existing_business() is
    'Prevents registration applications from creating a duplicate of an existing business.';
