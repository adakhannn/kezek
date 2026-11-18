-- Dashboard bookings list: search over the whole history (17 Nov review,
-- docs/PROJECT_REVIEW_2026-11-17.md FE-03). The list loaded one 30-row page through PostgREST and
-- searched only those rows in the browser (WB-135 left "search beyond the loaded page" open); the
-- counters showed the unfiltered total and offset pages had no fixed order for equal start times.
-- One read for business managers now filters, searches, orders (start_at desc, id desc), pages and
-- counts the matches. Access as in staff_private_fields: the service role, or
-- finance_can_manage_business (owner, owner/admin/manager role, platform admin). Display names of
-- registered clients without a stored name come from profiles, as /api/bookings/client-identities
-- did, and only for this business's bookings.
begin;

create or replace function public.dashboard_bookings_page(
    p_biz_id uuid,
    p_status text default 'notCancelled',
    p_branch_id uuid default null,
    p_staff_id uuid default null,
    p_start_from timestamptz default null,
    p_start_before timestamptz default null,
    p_search text default null,
    p_limit integer default 30,
    p_offset integer default 0
)
returns jsonb
language plpgsql
stable
security definer
set search_path = pg_catalog, public
as $$
declare
    v_actor uuid := auth.uid();
    v_statuses public.booking_status[];
    v_exclude_cancelled boolean := false;
    v_raw text := left(nullif(btrim(coalesce(p_search, '')), ''), 100);
    v_pattern text;
    v_hex text;
    v_id_prefix text;
    v_digits text;
    v_limit integer := least(greatest(coalesce(p_limit, 30), 1), 100);
    v_offset integer := least(greatest(coalesce(p_offset, 0), 0), 100000);
    v_result jsonb;
begin
    if p_biz_id is null
       or not (coalesce(auth.role(), '') = 'service_role'
               or coalesce(public.finance_can_manage_business(v_actor, p_biz_id), false)) then
        raise exception 'DASHBOARD_BOOKINGS_FORBIDDEN' using errcode = '42501';
    end if;

    case coalesce(p_status, 'notCancelled')
        when 'notCancelled' then v_exclude_cancelled := true;
        when 'any' then null;
        when 'holdConfirmed' then v_statuses := array['hold', 'confirmed']::public.booking_status[];
        when 'hold', 'confirmed', 'paid', 'cancelled', 'no_show' then v_statuses := array[p_status]::public.booking_status[];
        else raise exception 'DASHBOARD_BOOKINGS_BAD_STATUS' using errcode = '22023';
    end case;

    if v_raw is not null then
        -- a literal substring: the backslash is the LIKE escape character
        v_pattern := '%' || replace(replace(replace(v_raw, chr(92), chr(92) || chr(92)), '%', chr(92) || '%'), '_', chr(92) || '_') || '%';
        -- the list shows '#' and the first 8 characters of the id; dashes are ignored
        v_hex := replace(lower(ltrim(v_raw, '#')), '-', '');
        if v_hex ~ '^[0-9a-f]{4,32}$' then
            v_id_prefix := v_hex;
        end if;
        -- phones are stored as +996555123456 and as free text from the desk (0555 12-34-56)
        if v_raw ~ '^[0-9 ()+.-]+$' and length(regexp_replace(v_raw, '[^0-9]', '', 'g')) >= 3 then
            v_digits := regexp_replace(v_raw, '[^0-9]', '', 'g');
        end if;
    end if;

    with matched as (
        select b.id, b.start_at
          from public.bookings b
         where b.biz_id = p_biz_id
           and (v_statuses is null or b.status = any (v_statuses))
           and (not v_exclude_cancelled or b.status <> 'cancelled')
           and (p_branch_id is null or b.branch_id = p_branch_id)
           and (p_staff_id is null or b.staff_id = p_staff_id)
           and (p_start_from is null or b.start_at >= p_start_from)
           and (p_start_before is null or b.start_at < p_start_before)
           and (v_raw is null
                or (v_id_prefix is not null and replace(b.id::text, '-', '') like v_id_prefix || '%')
                or b.client_name ilike v_pattern
                or b.client_phone ilike v_pattern
                or (v_digits is not null
                    and regexp_replace(coalesce(b.client_phone, ''), '[^0-9]', '', 'g') like '%' || v_digits || '%')
                or (b.client_id is not null and nullif(btrim(b.client_name), '') is null
                    and exists (select 1 from public.profiles pr
                                 where pr.id = b.client_id and pr.full_name ilike v_pattern))
                or exists (select 1 from public.staff s
                            where s.id = b.staff_id and s.biz_id = p_biz_id and s.full_name ilike v_pattern)
                or exists (select 1 from public.services sv
                            where sv.id = b.service_id and sv.biz_id = p_biz_id
                              and (sv.name_ru ilike v_pattern or sv.name_ky ilike v_pattern or sv.name_en ilike v_pattern))
                or exists (select 1 from public.booking_services bs
                             join public.services sv on sv.id = bs.service_id
                            where bs.booking_id = b.id and sv.biz_id = p_biz_id
                              and (sv.name_ru ilike v_pattern or sv.name_ky ilike v_pattern or sv.name_en ilike v_pattern)))
    ), page as (
        select m.id, m.start_at
          from matched m
         order by m.start_at desc, m.id desc
         limit v_limit offset v_offset
    )
    select jsonb_build_object(
        'total', (select count(*) from matched),
        'rows', coalesce((
            select jsonb_agg(jsonb_build_object(
                       'id', b.id,
                       'status', b.status,
                       'start_at', b.start_at,
                       'end_at', b.end_at,
                       'branch_id', b.branch_id,
                       'staff_id', b.staff_id,
                       'client_id', b.client_id,
                       'client_name', coalesce(nullif(btrim(b.client_name), ''), nullif(btrim(pr.full_name), '')),
                       'client_phone', b.client_phone,
                       'service', case when sv.id is null then null
                                       else jsonb_build_object('name_ru', sv.name_ru, 'name_ky', sv.name_ky, 'name_en', sv.name_en) end,
                       'staff_name', st.full_name,
                       'booking_services', coalesce((
                           select jsonb_agg(jsonb_build_object(
                                      'duration_min', bs.duration_min,
                                      'service', case when s2.id is null then null
                                                      else jsonb_build_object('name_ru', s2.name_ru, 'name_ky', s2.name_ky, 'name_en', s2.name_en) end)
                                  order by bs.order_index nulls last, bs.id)
                             from public.booking_services bs
                             left join public.services s2 on s2.id = bs.service_id
                            where bs.booking_id = b.id), '[]'::jsonb))
                   order by p.start_at desc, p.id desc)
              from page p
              join public.bookings b on b.id = p.id
              left join public.services sv on sv.id = b.service_id
              left join public.staff st on st.id = b.staff_id
              left join public.profiles pr on pr.id = b.client_id and nullif(btrim(b.client_name), '') is null
        ), '[]'::jsonb))
      into v_result;

    return v_result;
end;
$$;

-- New public functions get EXECUTE for anon and authenticated by default privileges.
revoke all on function public.dashboard_bookings_page(uuid, text, uuid, uuid, timestamptz, timestamptz, text, integer, integer)
    from public, anon, authenticated, service_role;
grant execute on function public.dashboard_bookings_page(uuid, text, uuid, uuid, timestamptz, timestamptz, text, integer, integer)
    to authenticated, service_role;

commit;
