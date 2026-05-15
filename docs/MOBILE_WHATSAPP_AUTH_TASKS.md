# Mobile WhatsApp Auth Tasks

## Goal

Enable sign-in for the mobile app via WhatsApp OTP with a safe, observable flow:
- Phase 1: use approved `UTILITY` template (works before full business verification).
- Phase 2: switch to `AUTHENTICATION` template when Meta permissions become available.

---

## Epic 1. Product and Flow Definition

- [x] Finalize UX flow for mobile WhatsApp login:
  - [x] enter phone number;
  - [x] request OTP via WhatsApp;
  - [x] enter OTP and complete session exchange.
- [x] Define fallback UX:
  - [x] if WhatsApp delivery fails -> retry + alternate method (Telegram/Google/email if enabled).
- [x] Fix user-facing copy for all states:
  - [x] code sent;
  - [x] wrong code;
  - [x] expired code;
  - [x] too many attempts;
  - [x] provider unavailable.
- [x] Add ADR with trade-offs:
  - [x] `UTILITY` now vs `AUTHENTICATION` later.

---

## Epic 2. Provider Setup and Secrets

- [x] Validate WhatsApp Cloud API configuration in production:
  - [x] `PHONE_NUMBER_ID` is `CONNECTED`;
  - [x] webhook is active and healthy.
- [x] Configure secure env variables:
  - [x] `WHATSAPP_ACCESS_TOKEN` (rotate compromised token);
  - [x] `WHATSAPP_PHONE_NUMBER_ID`;
  - [x] `WHATSAPP_WABA_ID`;
  - [x] `WHATSAPP_OTP_TEMPLATE_NAME`;
  - [x] `WHATSAPP_OTP_TEMPLATE_LANG`.
- [x] Document token rotation and expiry policy.
- [x] Confirm template contract:
  - [x] exact variable count and order for current approved template.

---

## Epic 3. Backend API for WhatsApp Login

- [x] Add endpoint `POST /api/auth/whatsapp/mobile/start`:
  - [x] validate phone format (E.164);
  - [x] create OTP attempt (TTL, pending);
  - [x] send template message via WhatsApp provider;
  - [x] return masked destination + `attemptId` + `expiresAt`.
- [x] Add endpoint `POST /api/auth/whatsapp/mobile/verify`:
  - [x] validate OTP code;
  - [x] consume OTP once;
  - [x] create/find user by phone;
  - [x] issue mobile exchange code.
- [x] Integrate with existing mobile exchange/session service:
  - [x] reuse current access/refresh logic;
  - [x] avoid duplicate auth/session logic.
- [x] Add idempotency for start/verify network retries.
- [x] Add robust provider error mapping:
  - [x] template mismatch;
  - [x] rate limit;
  - [x] recipient not on WhatsApp;
  - [x] temporary provider outage.

---

## Epic 4. OTP Security and Abuse Protection

- [x] OTP policy:
  - [x] code length and entropy;
  - [x] TTL (example: 2-5 minutes);
  - [x] max attempts before lock.
- [x] One-time guarantees:
  - [x] OTP consumed after success;
  - [x] attempt invalidated after max failures or expiry.
- [x] Rate limiting and anti-bruteforce:
  - [x] per phone number;
  - [x] per IP/device fingerprint (if available);
  - [x] per endpoint (`start`, `verify`).
- [x] Replay protection and request signing where applicable.
- [x] Logging safety:
  - [x] never log raw OTP or full phone number;
  - [x] mask sensitive fields.

---

## Epic 5. Mobile App Integration

- [x] Add WhatsApp login entry point in `SignInScreen`.
- [x] Implement `startWhatsAppLogin()`:
  - [x] submit phone;
  - [x] show countdown/expiry;
  - [x] handle resend cooldown.
- [x] Implement OTP verify UI:
  - [x] code input;
  - [x] submit + loading + disabled states;
  - [x] clear error messages.
- [x] On success:
  - [x] perform mobile exchange;
  - [x] establish Supabase session;
  - [x] navigate to authorized area.
- [x] Recovery behavior:
  - [x] app background/foreground during OTP wait;
  - [x] screen restart with active pending attempt.

---

## Epic 6. Template Strategy (`UTILITY` -> `AUTHENTICATION`)

- [x] Keep template configurable via env:
  - [x] no template name hardcoded in business logic.
- [x] Build with current approved `UTILITY` template first.
- [x] Create migration checklist for `AUTHENTICATION` switch:
  - [x] new template created/approved;
  - [x] parameter schema updated;
  - [x] staging smoke passes;
  - [x] production flag switch.

---

## Epic 7. Data Model and Cleanup

- [x] Create/validate auth attempts table for WhatsApp OTP:
  - [x] phone hash/masked phone;
  - [x] status;
  - [x] otp hash;
  - [x] expires_at;
  - [x] consumed_at;
  - [x] created_at.
- [x] Indexes:
  - [x] by `status + expires_at`;
  - [x] by normalized phone / attempt lookup key.
- [x] Add cleanup job:
  - [x] remove or archive expired attempts on schedule.

---

## Epic 8. Testing

- [x] Unit tests:
  - [x] OTP generate/hash/verify/consume;
  - [x] TTL/expiry behavior;
  - [x] rate-limit guard behavior.
- [x] API tests:
  - [x] start success/failure;
  - [x] verify success/invalid/expired/consumed;
  - [x] idempotent retry scenarios.
- [x] Integration tests:
  - [x] full happy-path (start -> verify -> session);
  - [x] wrong code then success;
  - [x] expired OTP;
  - [x] provider temporary failure + retry.
- [x] Mobile smoke:
  - [x] successful login;
  - [x] resend flow;
  - [x] app returns from background.

---

## Epic 9. Observability and Operations

- [x] Metrics:
  - [x] `mobile_whatsapp_login_started`;
  - [x] `mobile_whatsapp_otp_sent`;
  - [x] `mobile_whatsapp_login_success`;
  - [x] `mobile_whatsapp_login_failed`;
  - [x] `mobile_whatsapp_login_expired`.
- [x] Structured logs by flow stage (without sensitive data).
- [x] Alerts:
  - [x] failed rate spike;
  - [x] sent->success conversion drop;
  - [x] provider API error spike.
- [x] Dashboard for funnel visibility:
  - [x] start -> sent -> verify -> success.

---

## Epic 10. Rollout and Rollback

- [x] Add feature flag `mobile_whatsapp_auth`.
- [ ] Staged rollout:
  - [ ] internal;
  - [ ] staging;
  - [ ] % production;
  - [ ] 100%.
- [x] Rollback plan:
  - [x] immediate disable via flag;
  - [x] fallback to existing login methods.
- [x] On-call runbook:
  - [x] common errors;
  - [x] emergency actions;
  - [x] verification checklist.

---

## Priorities

### P0 (MVP)

- [ ] Epics 1-5 with `UTILITY` template.
- [ ] Core security controls (rate limit, one-time OTP, TTL).
- [ ] Basic tests: happy-path + invalid + expired.
- [ ] Feature flag and rollback readiness.

### P1

- [ ] Full observability and alert tuning.
- [ ] Extended integration scenarios and retries.
- [ ] UX polish and troubleshooting hints.

### P2

- [ ] Migrate to `AUTHENTICATION` template when business permissions allow.

---

## Definition of Done

- [ ] Mobile user can sign in via WhatsApp OTP without web dependency.
- [ ] OTP is one-time, short-lived, and brute-force protected.
- [ ] Session is created only through existing secure exchange flow.
- [ ] Sensitive data is masked in logs and traces.
- [ ] Negative scenarios (invalid/expired/retry/failure) are covered.
- [ ] Feature flag, staged rollout, and rollback are operational.

---

## Rollout Plan (Operational)

1. Internal (team only)
- Set `MOBILE_WHATSAPP_AUTH=true`
- Set `MOBILE_WHATSAPP_AUTH_ROLLOUT_PERCENT=0`
- Allow internal testers only via rollout key header (`x-mobile-rollout-key`) or temporary percent bump to 1-5%.
- Verify:
  - `/api/auth/whatsapp/mobile/start` returns `ok: true` for allowed testers;
  - non-allowed users get `503 service_unavailable`;
  - events appear in `analytics_events` with `source='mobile_auth_whatsapp'`.

2. Staging
- `MOBILE_WHATSAPP_AUTH=true`
- `MOBILE_WHATSAPP_AUTH_ROLLOUT_PERCENT=100`
- Run smoke:
  - start -> verify -> mobile exchange success;
  - invalid code;
  - expired code;
  - provider failure mapping.

3. Production phased rollout
- Phase A: `MOBILE_WHATSAPP_AUTH_ROLLOUT_PERCENT=10` for 24h
- Phase B: `MOBILE_WHATSAPP_AUTH_ROLLOUT_PERCENT=30` for 24h
- Phase C: `MOBILE_WHATSAPP_AUTH_ROLLOUT_PERCENT=50` for 24h
- Phase D: `MOBILE_WHATSAPP_AUTH_ROLLOUT_PERCENT=100`
- Gates between phases:
  - no sustained alert `failed_spike_15m`;
  - `success_rate_drop_1h` remains normal;
  - no unresolved P1/P0 incidents in auth path.

4. Mobile app toggle
- `EXPO_PUBLIC_MOBILE_WHATSAPP_AUTH=true` only when backend flag is enabled.
- If backend is disabled, set mobile flag to `false` to hide the button in SignIn UI.

---

## Rollback Runbook (Operational)

Trigger conditions:
- sustained failures in WhatsApp provider/API;
- abnormal increase in `mobile_whatsapp_login_failed`;
- conversion drop (`success_rate_drop_1h`) for > 10 minutes;
- critical incident in OTP/session exchange path.

Immediate actions (<= 5 min):
1. Backend kill switch:
- Set `MOBILE_WHATSAPP_AUTH=false` and redeploy.
2. UI kill switch:
- Set `EXPO_PUBLIC_MOBILE_WHATSAPP_AUTH=false` for next mobile build/release channel.
3. Keep fallback methods active:
- Telegram and Google login remain available.

Verification checklist after rollback:
1. API check:
- `/api/auth/whatsapp/mobile/start` returns `503 service_unavailable`.
2. UI check:
- WhatsApp login button hidden/disabled in mobile sign-in.
3. Auth continuity:
- Telegram login works.
- Google login works.
4. Metrics check:
- No new `mobile_auth_whatsapp` start/success events after rollback timestamp.

SQL quick checks:
```sql
-- recent whatsapp mobile auth events
select created_at, source, event_type
from analytics_events
where source = 'mobile_auth_whatsapp'
  and created_at >= now() - interval '60 minutes'
order by created_at desc;
```

```sql
-- auth channel continuity (example)
select event_type, count(*) as cnt
from analytics_events
where created_at >= now() - interval '60 minutes'
  and event_type in (
    'mobile_whatsapp_login_started',
    'mobile_whatsapp_login_success',
    'telegram_mobile_login_started',
    'mobile_google_login_started'
  )
group by event_type
order by cnt desc;
```

