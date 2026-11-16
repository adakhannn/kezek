create or replace function public.cancel_business_role_application(
    p_application_id uuid,
    p_user_id uuid
)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
    v_biz_id uuid;
    v_role text;
begin
    update public.business_role_applications
       set status = 'cancelled', updated_at = now()
     where id = p_application_id
       and applicant_user_id = p_user_id
       and status = 'pending'
     returning biz_id, requested_role into v_biz_id, v_role;

    if not found then return false; end if;

    insert into public.application_moderation_actions(
        application_kind, application_id, action, actor_user_id,
        target_user_id, biz_id, reason
    ) values (
        v_role, p_application_id, 'cancelled', p_user_id,
        p_user_id, v_biz_id, 'Отозвано заявителем'
    );
    return true;
end;
$$;

revoke all on function public.cancel_business_role_application(uuid, uuid) from public, anon, authenticated;
grant execute on function public.cancel_business_role_application(uuid, uuid) to service_role;
