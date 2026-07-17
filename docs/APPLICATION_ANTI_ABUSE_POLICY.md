# Application anti-abuse policy

Date: `2026-07-17`

## Scope

This policy covers:

- public applications to register a new business;
- authenticated applications to become an owner of an existing business;
- authenticated applications to become a staff member of an existing business.

## Enforcement layers

1. Route rate limits reduce automated request volume by IP for guests and by user ID for authenticated applicants.
2. PostgreSQL insert triggers enforce durable limits, duplicates, cooldowns, ownership conflicts, and moderator blocks under an advisory transaction lock.
3. Partial uniqueness for pending role applications prevents concurrent duplicates for the same user, business, and role.
4. Moderation rejection and applicant cancellation use transactional RPC functions and append an audit event.

The database is authoritative. UI validation exists only to provide earlier feedback.

## Limits

### New business registration

- Maximum two active applications (`new` or `contacted`) per user/phone.
- Maximum three submissions per user/phone in 30 days.
- Same business name plus the same user/phone cannot be active twice.
- A rejected applicant has a 24-hour cooldown.
- Guest applications are marked with `guest_submission` for moderation.

### Owner applications

- Authentication is mandatory.
- Maximum three pending owner applications across businesses.
- One pending application per user, business, and role.
- Reapplication to the same business has a seven-day cooldown after rejection.
- A meaningful explanation (20+ characters) or a valid Instagram/2GIS/Google Maps/Yandex Maps URL is mandatory.

### Staff applications

- Authentication is mandatory.
- Maximum five pending staff applications across businesses.
- One pending application per user, business, and role.
- Reapplication to the same business has a three-day cooldown after rejection.
- An existing owner cannot apply as staff to the same business.

## Moderation and blocks

Reviewers may reject normally or reject and block submissions for 30 days. Blocks are stored separately in `application_submission_blocks`; decisions are appended to `application_moderation_actions`. Applicant cancellation also creates an audit action.

Risk badges are snapshots created on submission:

- `guest_submission`;
- `repeat_applicant`;
- `prior_rejection`;
- `multiple_rejections`;
- `high_submission_volume`.

## Database objects

- migrations `20260717040000_application_abuse_protection.sql`, `20260717050000_cancel_business_role_application.sql`, and `20260717060000_version_role_application_policy.sql`;
- trigger functions `enforce_business_registration_application_policy()` and `enforce_business_role_application_policy()`;
- RPC functions `reject_application_with_policy(...)` and `cancel_business_role_application(...)`;
- tables `application_submission_blocks` and `application_moderation_actions`.

All new tables and RPC functions are restricted to `service_role`; public and authenticated clients cannot bypass the server routes.

Role submissions carry `policy_version`. Version `0` keeps the pre-deployment production client compatible during rollout; the new client sends version `1`, enabling mandatory structured owner-proof enforcement without a database/UI deployment race.

## Remaining operational enhancement

The existing honeypot and IP/user rate limits are active. Adaptive CAPTCHA can be added later after a provider and production keys are selected; it is intentionally not a hard dependency that could block legitimate submissions when the external provider is unavailable.
