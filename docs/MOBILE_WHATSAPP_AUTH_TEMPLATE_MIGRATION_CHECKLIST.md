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

- [ ] New `AUTHENTICATION` template exists.
- [ ] Status is `APPROVED`.
- [ ] Policy/legal copy validated (OTP wording, no marketing text).

---

## 2) Parameter Schema Update

- [ ] Confirm component schema for `AUTHENTICATION` template.
- [ ] Update send payload parameters if count/order differs from current `UTILITY` template.
- [ ] Validate provider response with a dry-run message to a test recipient.

---

## 3) Configuration Switch (No Code Fork)

- [ ] Set `WHATSAPP_OTP_TEMPLATE_NAME=<new_auth_template_name>`.
- [ ] Set `WHATSAPP_OTP_TEMPLATE_LANG=<exact_language_code>`.
- [ ] Keep legacy fallback vars unchanged unless needed.

---

## 4) Staging Smoke

- [ ] `POST /api/auth/whatsapp/mobile/start` returns `attemptId` and `expiresAt`.
- [ ] Message is delivered with correct template rendering.
- [ ] `POST /api/auth/whatsapp/mobile/verify` returns `exchangeCode`.
- [ ] Mobile session exchange succeeds end-to-end.
- [ ] Negative checks:
  - [ ] wrong OTP;
  - [ ] expired OTP;
  - [ ] retry/idempotency behavior.

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

