# Mobile WhatsApp Template Migration Checklist

## Scope

Switch mobile OTP flow from `UTILITY` template to `AUTHENTICATION` template with minimal risk.

Date: 2026-05-01

---

## Preconditions

- `AUTHENTICATION` template created in WhatsApp Manager.
- Template status is `APPROVED`.
- Required placeholders and language are known.

Record:
- Template name: `________________`
- Language code: `________________`
- Required body params count: `________________`

---

## 1) Template Approval Gate

- [x] New `AUTHENTICATION` template exists.
- [x] Status is `APPROVED`.
- [x] Policy/legal copy validated (OTP wording, no marketing text).

---

## 2) Parameter Schema Update

- [x] Confirm component schema for `AUTHENTICATION` template.
- [x] Update send payload parameters if count/order differs from current `UTILITY` template.
- [x] Validate provider response with a dry-run message to a test recipient.

---

## 3) Configuration Switch (No Code Fork)

- [x] Set `WHATSAPP_OTP_TEMPLATE_NAME=<new_auth_template_name>`.
- [x] Set `WHATSAPP_OTP_TEMPLATE_LANG=<exact_language_code>`.
- [x] Keep legacy fallback vars unchanged unless needed.
- [x] Set `WHATSAPP_OTP_TEMPLATE_TYPE=authentication`.
- [x] (Optional) set `WHATSAPP_OTP_TEMPLATE_COMPONENTS_JSON` when provider schema requires custom components.

---

## 4) Staging Smoke

- [x] `POST /api/auth/whatsapp/mobile/start` returns `attemptId` and `expiresAt`.
- [x] Message is delivered with correct template rendering.
- [x] `POST /api/auth/whatsapp/mobile/verify` returns `exchangeCode`.
- [x] Mobile session exchange succeeds end-to-end.
- [x] Negative checks:
  - [x] wrong OTP;
  - [x] expired OTP;
  - [x] retry/idempotency behavior.

---

## 5) Production Flag/Config Rollout

- [ ] Rollout in controlled window.
- [ ] Monitor:
  - [ ] OTP send errors;
  - [ ] verify failure rate;
  - [ ] login success conversion.
- [ ] Keep rollback command/env ready.

---

## 6) Rollback Plan

If any regression appears:

1. Revert env to previous `UTILITY` template:
   - `WHATSAPP_OTP_TEMPLATE_NAME=<previous_utility_template>`
   - `WHATSAPP_OTP_TEMPLATE_LANG=<previous_lang>`
2. Redeploy/restart.
3. Re-run smoke.
4. Keep incident notes with provider error IDs.

