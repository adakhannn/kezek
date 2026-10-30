-- Category names and slugs are public discovery metadata. Keep inactive rows
-- private to the existing authenticated policy; do not allow anonymous writes.
begin;

create policy categories_public_active_select
    on public.categories
    for select
    to anon
    using (is_active is true);

commit;
