-- Three internal tables were open to API clients by always-true policies:
--   * staff_shift_aggregates (per-staff shift count, revenue, master/salon shares, lateness):
--     policy "Staff shift aggregates all" gave anon and authenticated ALL with USING (true),
--     so the public anon key could read every salary total and rewrite or delete them.
--     Only update_shift_aggregates (SECURITY DEFINER) and the service role write it; the
--     application reads finance through checked RPCs. Staff keep reading their own rows.
--   * whatsapp_otp_codes: "Allow insert for OTP codes" let anon insert OTP attempts. Logins
--     were not at risk (consume_whatsapp_mobile_otp requires the server-side HMAC), but the
--     server writes this table with the service role only.
--   * super_admins_legacy: every signed-in account could list all super admin ids;
--     is_super_admin() is SECURITY DEFINER and does not need the policy.
begin;

drop policy if exists "Staff shift aggregates all" on public.staff_shift_aggregates;
drop policy if exists "Staff shift aggregates own all" on public.staff_shift_aggregates;
create policy "Staff shift aggregates own read" on public.staff_shift_aggregates
    for select to authenticated
    using (exists (
        select 1 from public.staff s
         where s.id = staff_shift_aggregates.staff_id
           and s.user_id = (select auth.uid())
           and s.is_active = true
    ));
revoke all on table public.staff_shift_aggregates from anon;
revoke insert, update, delete, truncate, references, trigger on table public.staff_shift_aggregates from authenticated;

drop policy if exists "Allow insert for OTP codes" on public.whatsapp_otp_codes;
revoke all on table public.whatsapp_otp_codes from anon, authenticated;

drop policy if exists "read super_admins (auth)" on public.super_admins_legacy;
create policy "read own super_admin row" on public.super_admins_legacy
    for select to authenticated
    using (user_id = (select auth.uid()));
revoke all on table public.super_admins_legacy from anon;

commit;
