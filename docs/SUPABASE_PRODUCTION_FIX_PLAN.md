# Supabase production fix plan

Last updated: 2026-07-14 local  
Owner: User + Codex  
Status: Active  
Environment: Supabase production project `beulnmftzbmtbdlgurht`, app `kezek.kg`

## Purpose

This document tracks the staged repair of production Supabase issues found after the user cleanup and production DB audit.

Rules for this plan:

- Fix production in small, reviewable stages.
- Before each stage, record the exact scope and risk.
- After each stage, record verification SQL, live/app verification where relevant, evidence, and remaining gaps.
- Do not run destructive SQL unless the user explicitly confirms that stage.
- Do not print secrets, tokens, OTPs, cookies, or service role keys.

## Status values

- `not started`
- `in progress`
- `blocked`
- `fixed`
- `verified`
- `accepted risk`

## Initial audit snapshot

Date: 2026-07-08 local / 2026-07-07 UTC  
Method: read-only SQL audit in Supabase SQL Editor.

### Migration drift

Production currently reports only these July 2026 migrations as applied:

- `20260704010000`
- `20260704020000`

Production is missing later schema objects that current app code expects.

### Missing production objects

- Table `public.account_deletion_requests`
- Table `public.business_registration_applications`
- Column `public.businesses.branch_limit`
- Trigger `branches_enforce_business_limit`
- Function/RPC `public.unlink_auth_identity(uuid, text)`
- Function/RPC `public.finalize_due_account_deletions(integer)`
- Function `public.enforce_business_branch_limit()`

### Data snapshot

- Auth users: `1`
- Profiles: `1`
- Businesses: `4`
- Branches: `3`
- Services: `25`
- Staff: `9`
- Bookings: `31`
- Active future bookings: `0`
- Businesses without owner: `4`
- Staff records without user: `9`
- `user_roles` rows pointing to missing business: `1`

The owner/staff detach state is expected after the approved production user cleanup, but it still needs a later operational flow for re-linking roles.

### Security findings

- `staff_shift_aggregates` has an unsafe policy: `ALL true` for `anon`, `authenticated`, and `service_role`.
- `telegram_mobile_auth_attempts` has RLS disabled.
- `frontend_metrics` is publicly readable via `SELECT true`.
- Several `SECURITY DEFINER` functions lack explicit `search_path`. Some are PostGIS/system functions; app-owned functions must be reviewed separately.

## Stage 1. Sync production schema with current app code

Status: `fixed`

Goal:

- Apply the missing post-`20260704020000` schema changes needed by the deployed/current code.

Scope:

- Create `account_deletion_requests`.
- Create `business_registration_applications`.
- Add and backfill `businesses.branch_limit`.
- Add `businesses_branch_limit_positive`.
- Create `enforce_business_branch_limit()`.
- Create trigger `branches_enforce_business_limit`.
- Create `unlink_auth_identity(uuid, text)`.
- Create `finalize_due_account_deletions(integer)`.

Expected result:

- Account deletion code no longer fails on missing table/RPC.
- Business application form/admin page no longer fails on missing table.
- Branch limit pages/API no longer fail on missing `branch_limit`.
- Google unlink no longer fails on missing RPC.
- Database enforces branch caps.

Verification:

- Check applied objects via `information_schema`, `pg_proc`, `information_schema.triggers`.
- Check business branch limits are initialized to `max(current_branch_count, 1)`.
- Check no business has `branch_count > branch_limit`.
- Smoke app flows:
  - `/business/apply`
  - `/admin/business-applications`
  - dashboard/admin branch list
  - cabinet profile social unlink UI
  - account deletion panel

Evidence:

- 2026-07-08 local / 2026-07-07 UTC: Stage started. Preparing idempotent production SQL for missing post-`20260704020000` schema objects.
- 2026-07-08 local / 2026-07-07 UTC: Applied Stage 1 SQL in Supabase SQL Editor as one transaction.
- Supabase `stage1_result`:
  - `account_deletion_requests`: `true`
  - `business_registration_applications`: `true`
  - `businesses_branch_limit`: `true`
  - `branches_enforce_business_limit`: `true`
  - `unlink_auth_identity`: `true`
  - `finalize_due_account_deletions`: `true`
  - `branch_limit_violations`: `0`
  - recent July migrations now include `20260704010000`, `20260704020000`, `20260705010000`, `20260706010000`, `20260706020000`, `20260707010000`, `20260707020000`.
- Independent verification SQL:
  - All expected tables/functions/trigger/check constraint exist.
  - Business count: `4`
  - Branch count: `3`
  - Branch limit violations: `0`
  - Branch limits:
    - `barbershop-aza`: `0 / 1`
    - `low-fade`: `1 / 1`
    - `manly`: `1 / 1`
    - `obraz`: `1 / 1`
  - `account_deletion_requests` rows: `0`
  - `business_registration_applications` rows: `0`
- Production smoke:
  - `https://kezek.kg/business/apply` loads correctly and shows the public business application form.
  - Browser console errors on `/business/apply`: none observed.
- 2026-07-14 local: Protected smoke after fresh production login as `osorovadahan04@gmail.com`:
  - `/cabinet/bookings` loads as authenticated client, no console errors observed.
  - `/cabinet/profile` loads profile/social login/notification/account deletion sections, no console errors observed.
  - `/dashboard/branches` denies dashboard access with an understandable no-business/no-role page, no console errors observed.
  - `/admin/business-applications` unexpectedly renders admin applications UI for a user with no `global_roles`, no `business_roles`, and no profile row. Logged as `WB-045`.
- 2026-07-14 local: Post-fix live production smoke after deploying `WB-045` fix:
  - `/admin/business-applications` as `osorovadahan04@gmail.com` now renders the intended no-access screen.
  - Visible UI includes `ДОСТУП ОГРАНИЧЕН`, `Нужны права супер-админа`, current account `osorovadahan04@gmail.com`, and required role `global super_admin`.
  - Browser console errors: none observed.
  - `WB-045` marked `verified`.

Remaining gaps:

- Stage 1 DB sync is fixed and verified.
- Protected smoke for ordinary authenticated client is verified for the checked paths.
- Negative admin protected smoke is verified after `WB-045` fix.
- Need a separate intended superadmin account/role before validating the positive admin path.

## Stage 2. Branch limit functional verification

Status: `not started`

Goal:

- Confirm the new business branch cap works in both UI and DB.

Scope:

- Existing businesses keep current branch count as limit, minimum `1`.
- New business requires superadmin-selected limit.
- Owner cannot exceed limit.
- Superadmin can edit limit safely.
- DB trigger rejects over-limit insert even if UI/API is bypassed.

Verification:

- Read-only check of business branch counts vs limits.
- Live test with a safe test business/entity only.
- Confirm over-limit attempt returns explicit safe error.

Evidence:

- Pending.

Remaining gaps:

- Pending.

## Stage 3. Business registration applications

Status: `not started`

Goal:

- Make business registration requests usable by guest, authenticated client, owner, staff, and admin roles.

Scope:

- Public form `/business/apply`.
- Server route `/api/business-applications`.
- Admin list `/admin/business-applications`.
- Status update flow.
- Duplicate/rate-limit feedback.
- RLS/service-role-only write/read behavior.

Verification:

- Guest submits safe test application.
- Authenticated user submits safe test application.
- Admin can see and update status.
- Public users cannot read application list directly.

Evidence:

- Pending.

Remaining gaps:

- Pending.

## Stage 4. Account deletion lifecycle

Status: `not started`

Goal:

- Make self-account deletion safe for different roles and data ownership states.

Scope:

- Request deletion.
- Cancel deletion.
- Block deletion for superadmin, owner, staff, active future bookings, or other protected state.
- Finalize due deletion through service role/cron RPC.
- Anonymize historical bookings without breaking business history.

Verification:

- Role/blocker matrix.
- Safe test account only.
- Read-only DB verification after request/cancel/finalize.

Evidence:

- Pending.

Remaining gaps:

- Pending.

## Stage 5. Social login unlink and account connection consistency

Status: `not started`

Goal:

- Ensure users can connect/unlink social login methods without account takeover or lockout.

Scope:

- Google unlink through `unlink_auth_identity`.
- Yandex unlink through profile/auth metadata cleanup.
- Telegram unlink.
- WhatsApp unlink.
- Prevent unlinking the last login method.
- Ensure connected status refreshes correctly after unlink.
- Ensure a social identity already attached to another Kezek account cannot be attached to the current account.

Verification:

- Live cabinet profile checks with safe accounts.
- DB checks for `auth.identities`, `profiles`, and notification preferences.
- Replay/refresh after unlink.

Evidence:

- Pending.

Remaining gaps:

- Pending.

## Stage 6. RLS and grants hardening

Status: `not started`

Goal:

- Remove unsafe public access while preserving server-side app flows.

Scope:

- Fix `staff_shift_aggregates`:
  - Remove `ALL true` for `anon/authenticated`.
  - Keep service role full access.
  - Allow staff to read only own aggregates.
  - Allow owner/admin/manager only within their business.
- Fix `telegram_mobile_auth_attempts`:
  - Enable RLS.
  - Revoke anon/authenticated direct access.
  - Keep service role access.
- Fix `frontend_metrics`:
  - Allow public insert if needed.
  - Remove public select/update/delete.
  - Keep service role/admin read.
- Review app-owned `SECURITY DEFINER` functions without explicit `search_path`.

Verification:

- Read-only grants/policies audit.
- Attempt public/client access where safe.
- Confirm server routes still work.

Evidence:

- Pending.

Remaining gaps:

- Pending.

## Stage 7. Cleanup after approved user purge

Status: `not started`

Goal:

- Remove leftover orphan records without deleting useful business structure.

Scope:

- Delete stale `user_roles` rows pointing to missing businesses.
- Keep businesses, branches, services, staff records for re-linking.
- Document which businesses need owner reassignment.
- Prepare follow-up flow for users to request special roles after re-registration.

Verification:

- Orphan count returns `0`.
- Business/branch/service counts remain unchanged unless explicitly approved.

Evidence:

- Pending.

Remaining gaps:

- Pending.

## Execution log

### 2026-07-08 local / 2026-07-07 UTC

- Created this plan from production read-only audit.
- No production changes made in this step.
- Stage 1 applied in production Supabase and DB verification passed.
- Public `/business/apply` smoke passed.
- Protected authenticated smoke deferred until fresh superadmin login.
- 2026-07-14 local: Fresh authenticated client smoke performed.
- 2026-07-14 local: Found `WB-045` P0 admin authorization bug on `/admin/business-applications`.
- 2026-07-14 local: Prepared local code fix for `WB-045` by scoping admin layout super-admin lookup to current `user.id`.
