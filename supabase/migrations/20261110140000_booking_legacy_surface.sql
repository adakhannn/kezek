-- No runtime callers remain for these legacy readers. The old slot RPC scans
-- every staff member and bypasses the selected/paged public contract.
begin;
revoke all on function public.get_free_slots_service_day(uuid,uuid,date,integer,integer,text),
 public.booking_view_public(uuid) from public,anon,authenticated;
grant execute on function public.get_free_slots_service_day(uuid,uuid,date,integer,integer,text),
 public.booking_view_public(uuid) to service_role;
-- booking_receipt_public stays available: the current anonymous receipt page
-- intentionally reveals only time/status/staff/service composition by opaque
-- booking UUID, never client contact details or command authority.
commit;
