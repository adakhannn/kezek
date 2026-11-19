-- Editing a service is one transaction (17 Nov review, docs/PROJECT_REVIEW_2026-11-17.md ARCH-07).
--
-- A service offered in several branches is one services row per branch; the editor and the list
-- treat the rows of a business with the same name_ru as one service. POST /api/services/[id]/update
-- changed that group with separate requests: it updated the kept branches, inserted the new ones and
-- only then checked the branches being removed. A removed branch with future bookings answered 409
-- after the update and the inserts had been saved, a failed later step left the earlier ones, and two
-- concurrent edits could interleave.
--
-- update_service_group does the same work in one transaction. It locks every copy of the group in
-- id order, refuses a branch of another business, refuses the whole edit when a removed copy has
-- future bookings (single or complex), then updates the kept copies, adds the new branches and
-- removes the others. A removed copy that bookings or a visit package plan still reference is
-- switched off instead of deleted, as the single-service delete does (DB-14). Service role only.

create or replace function public.update_service_group(
    p_biz_id uuid,
    p_service_id uuid,
    p_branch_ids uuid[],
    p_name_ru text,
    p_name_ky text,
    p_name_en text,
    p_duration_min integer,
    p_price_from numeric,
    p_price_to numeric,
    p_active boolean
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
set lock_timeout = '5s'
as $$
declare
    v_name text;
    v_branches uuid[];
    v_missing uuid[];
    v_keep uuid[];
    v_remove uuid[];
    v_add uuid[];
    v_busy text[];
    v_copy uuid;
    v_updated integer := 0;
    v_deleted integer := 0;
    v_archived integer := 0;
begin
    select name_ru into v_name from public.services where id = p_service_id and biz_id = p_biz_id;
    if not found then
        raise exception using errcode = '42501', message = 'SERVICE_FORBIDDEN';
    end if;

    select array_agg(distinct b) into v_branches from unnest(p_branch_ids) b where b is not null;
    if v_branches is null then
        raise exception using errcode = '22023', message = 'SERVICE_BRANCH_REQUIRED';
    end if;
    select array_agg(b order by b) into v_missing from unnest(v_branches) b
     where not exists (select 1 from public.branches br where br.id = b and br.biz_id = p_biz_id);
    if v_missing is not null then
        raise exception using errcode = '42501', message = 'SERVICE_BRANCH_FORBIDDEN', detail = array_to_string(v_missing, ',');
    end if;

    -- The group as the editor shows it: every copy of the business with the edited row's name.
    -- Concurrent edits of one service, and bookings checking a copy, wait for this transaction.
    perform 1 from public.services where biz_id = p_biz_id and name_ru = v_name order by id for update;

    select coalesce(array_agg(distinct branch_id) filter (where branch_id = any(v_branches)), '{}'),
           coalesce(array_agg(distinct branch_id) filter (where not branch_id = any(v_branches)), '{}')
      into v_keep, v_remove
      from public.services
     where biz_id = p_biz_id and name_ru = v_name;
    select coalesce(array_agg(b order by b), '{}') into v_add from unnest(v_branches) b where not b = any(v_keep);

    -- A removed copy with future bookings blocks the whole edit: nothing is saved.
    select array_agg(distinct coalesce(br.name, s.branch_id::text) order by coalesce(br.name, s.branch_id::text))
      into v_busy
      from public.services s
      left join public.branches br on br.id = s.branch_id
     where s.biz_id = p_biz_id and s.name_ru = v_name and s.branch_id = any(v_remove)
       and (exists (select 1 from public.bookings bk
                     where bk.service_id = s.id and bk.start_at >= now() and bk.status <> 'cancelled')
            or exists (select 1 from public.booking_services bs join public.bookings bk on bk.id = bs.booking_id
                        where bs.service_id = s.id and bk.start_at >= now() and bk.status <> 'cancelled'));
    if v_busy is not null then
        raise exception using errcode = 'P0001', message = 'SERVICE_BRANCH_HAS_FUTURE_BOOKINGS', detail = array_to_string(v_busy, ', ');
    end if;

    update public.services
       set name_ru = p_name_ru, name_ky = p_name_ky, name_en = p_name_en, duration_min = p_duration_min,
           price_from = p_price_from, price_to = p_price_to, active = p_active
     where biz_id = p_biz_id and name_ru = v_name and branch_id = any(v_keep);
    get diagnostics v_updated = row_count;

    insert into public.services (biz_id, branch_id, name_ru, name_ky, name_en, duration_min, price_from, price_to, active)
    select p_biz_id, b, p_name_ru, p_name_ky, p_name_en, p_duration_min, p_price_from, p_price_to, p_active
      from unnest(v_add) b;

    for v_copy in
        select id from public.services
         where biz_id = p_biz_id and name_ru = v_name and branch_id = any(v_remove)
         order by id
    loop
        -- History and sold packages keep the copy: it is switched off instead (DB-14).
        if exists (select 1 from public.visit_package_plans where service_id = v_copy) then
            update public.services set active = false where id = v_copy;
            v_archived := v_archived + 1;
            continue;
        end if;
        begin
            delete from public.services where id = v_copy;
            v_deleted := v_deleted + 1;
        exception when foreign_key_violation then
            update public.services set active = false where id = v_copy;
            v_archived := v_archived + 1;
        end;
    end loop;

    return jsonb_build_object('updated', v_updated, 'added', cardinality(v_add), 'deleted', v_deleted, 'archived', v_archived);
end;
$$;

revoke all on function public.update_service_group(uuid, uuid, uuid[], text, text, text, integer, numeric, numeric, boolean)
    from public, anon, authenticated;
grant execute on function public.update_service_group(uuid, uuid, uuid[], text, text, text, integer, numeric, numeric, boolean)
    to service_role;
