alter table public.application_submission_blocks
    add column if not exists released_at timestamptz,
    add column if not exists released_by uuid references auth.users(id) on delete set null;

alter table public.application_moderation_actions
    drop constraint if exists application_moderation_actions_action_check;

alter table public.application_moderation_actions
    add constraint application_moderation_actions_action_check
    check (action in ('approved', 'rejected', 'rejected_and_blocked', 'cancelled', 'unblocked'));

create or replace function public.release_application_submission_block(
    p_block_id uuid,
    p_application_id uuid,
    p_reviewer_user_id uuid
)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
    v_block public.application_submission_blocks%rowtype;
begin
    update public.application_submission_blocks
       set blocked_until = least(blocked_until, now()),
           released_at = now(),
           released_by = p_reviewer_user_id
     where id = p_block_id
       and blocked_until > now()
       and released_at is null
     returning * into v_block;

    if not found then return false; end if;

    insert into public.application_moderation_actions(
        application_kind, application_id, action, actor_user_id,
        target_user_id, biz_id, reason, metadata
    ) values (
        v_block.application_kind, p_application_id, 'unblocked', p_reviewer_user_id,
        v_block.subject_user_id, v_block.biz_id, 'Блокировка снята модератором',
        jsonb_build_object('block_id', v_block.id)
    );
    return true;
end;
$$;

revoke all on function public.release_application_submission_block(uuid, uuid, uuid) from public, anon, authenticated;
grant execute on function public.release_application_submission_block(uuid, uuid, uuid) to service_role;
