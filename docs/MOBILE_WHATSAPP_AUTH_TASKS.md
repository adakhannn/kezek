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
- [ ] Mobile smoke:
  - [ ] successful login;
  - [ ] resend flow;
  - [ ] app returns from background.

---

## Epic 9. Observability and Operations

- [ ] Metrics:
  - [ ] `mobile_whatsapp_login_started`;
  - [ ] `mobile_whatsapp_otp_sent`;
  - [ ] `mobile_whatsapp_login_success`;
  - [ ] `mobile_whatsapp_login_failed`;
  - [ ] `mobile_whatsapp_login_expired`.
- [ ] Structured logs by flow stage (without sensitive data).
- [ ] Alerts:
  - [ ] failed rate spike;
  - [ ] sent->success conversion drop;
  - [ ] provider API error spike.
- [ ] Dashboard for funnel visibility:
  - [ ] start -> sent -> verify -> success.

---

## Epic 10. Rollout and Rollback

- [ ] Add feature flag `mobile_whatsapp_auth`.
- [ ] Staged rollout:
  - [ ] internal;
  - [ ] staging;
  - [ ] % production;
  - [ ] 100%.
- [ ] Rollback plan:
  - [ ] immediate disable via flag;
  - [ ] fallback to existing login methods.
- [ ] On-call runbook:
  - [ ] common errors;
  - [ ] emergency actions;
  - [ ] verification checklist.

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

