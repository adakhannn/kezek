-- Directory and social links belong to a physical branch, not to the business.
-- Registration applications keep the submitted links until the first branch exists.
alter table public.business_registration_applications
    add column if not exists directory_links jsonb not null default '{}'::jsonb;

alter table public.branches
    add column if not exists directory_links jsonb not null default '{}'::jsonb;

alter table public.business_registration_applications
    drop constraint if exists business_registration_applications_directory_links_object;

alter table public.business_registration_applications
    add constraint business_registration_applications_directory_links_object
    check (jsonb_typeof(directory_links) = 'object');

alter table public.branches
    drop constraint if exists branches_directory_links_object;

alter table public.branches
    add constraint branches_directory_links_object
    check (jsonb_typeof(directory_links) = 'object');

create or replace function public.apply_registration_links_to_first_branch()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
    submitted_links jsonb;
begin
    if coalesce(new.directory_links, '{}'::jsonb) <> '{}'::jsonb then
        return new;
    end if;

    if exists (select 1 from public.branches where biz_id = new.biz_id) then
        return new;
    end if;

    select coalesce(directory_links, '{}'::jsonb)
      into submitted_links
      from public.business_registration_applications
     where created_business_id = new.biz_id
       and jsonb_typeof(directory_links) = 'object'
       and directory_links <> '{}'::jsonb
     order by created_at asc
     limit 1;

    if submitted_links is not null and submitted_links <> '{}'::jsonb then
        new.directory_links := submitted_links;
    end if;

    return new;
end;
$$;

drop trigger if exists branches_apply_registration_links on public.branches;
create trigger branches_apply_registration_links
before insert on public.branches
for each row execute function public.apply_registration_links_to_first_branch();

comment on column public.business_registration_applications.directory_links is
    'Links submitted for the first physical branch: instagram, two_gis, google_maps, yandex_maps.';
comment on column public.branches.directory_links is
    'Public links for this physical branch: instagram, two_gis, google_maps, yandex_maps.';
