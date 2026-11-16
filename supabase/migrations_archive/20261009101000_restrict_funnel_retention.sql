-- The restored funnel ledger is server-only. Its pre-existing SECURITY DEFINER
-- retention function must not provide an indirect anonymous deletion path.
begin;

revoke execute on function public.cleanup_old_funnel_events(integer) from public, anon, authenticated;
grant execute on function public.cleanup_old_funnel_events(integer) to service_role;

commit;
