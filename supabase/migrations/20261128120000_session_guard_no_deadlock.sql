-- Prod Auth logs (26 and 27 Nov 2026): sign-ins failed with "error update user`s last_sign_in
-- field: deadlock detected". The session guard below takes FOR SHARE on the auth.users row and
-- Auth then updates last_sign_in_at in the same transaction. Two parallel sign-ins of one user
-- both held the share lock and both waited to upgrade it. A per-user transaction advisory lock,
-- taken first, makes them queue instead. The ban race check (ENG-31) is unchanged.
create or replace function public.guard_user_lifecycle_session() returns trigger
language plpgsql security definer set search_path=pg_catalog,public as $$
declare until_time timestamptz;
begin
  perform pg_advisory_xact_lock(184208, hashtext(new.user_id::text));
  select banned_until into until_time from auth.users where id=new.user_id for share;
  if not found or until_time>now() or exists(select 1 from public.user_suspensions where user_id=new.user_id) then
    raise exception 'USER_SUSPENDED' using errcode='42501';
  end if;
  return new;
end;
$$;
revoke all on function public.guard_user_lifecycle_session() from public,anon,authenticated,service_role;
