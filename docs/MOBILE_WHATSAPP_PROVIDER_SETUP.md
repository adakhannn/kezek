# Mobile WhatsApp Provider Setup (Epic 2)

## Scope

This document covers provider validation, required secrets, token rotation policy, and template contract for mobile WhatsApp OTP login.

Date: 2026-04-30

---

## 1) Production Validation Checklist

- `PHONE_NUMBER_ID` is `CONNECTED`.
- WhatsApp webhook is active and receives updates.

### API checks (PowerShell)

```powershell
$TOKEN="<PERMANENT_ACCESS_TOKEN>"
$PHONE_ID="<WHATSAPP_PHONE_NUMBER_ID>"
$WABA_ID="<WHATSAPP_WABA_ID>"
$headers=@{ Authorization = "Bearer $TOKEN" }

# 1. Check phone status
(Invoke-RestMethod -Method Get -Uri "https://graph.facebook.com/v22.0/$WABA_ID/phone_numbers?fields=id,display_phone_number,verified_name,quality_rating,code_verification_status,name_status,status" -Headers $headers) | ConvertTo-Json -Depth 8

# Expected for active number:
# - code_verification_status: VERIFIED
# - status: CONNECTED
```

```powershell
# 2. Check webhook status (Telegram-like equivalent for WhatsApp is in app diagnostics)
Invoke-RestMethod -Method Get -Uri "https://kezek.kg/api/whatsapp/diagnose" | ConvertTo-Json -Depth 8
```

Expected summary:
- `summary.tokenValid = true`
- `summary.hasBusinessAccounts = true`
- `summary.hasPhoneNumbers = true`
- `summary.phoneNumberIdValid = true`

---

## 2) Required Environment Variables

Set on server/runtime:

```env
WHATSAPP_ACCESS_TOKEN=<permanent-system-user-token>
WHATSAPP_PHONE_NUMBER_ID=<phone-number-id>
WHATSAPP_WABA_ID=<whatsapp-business-account-id>
WHATSAPP_VERIFY_TOKEN=<webhook-verify-token>

# Preferred names for OTP template
WHATSAPP_OTP_TEMPLATE_NAME=<approved-template-name>
WHATSAPP_OTP_TEMPLATE_LANG=<template-language-code>

# Backward compatibility (still supported)
WHATSAPP_AUTH_TEMPLATE_NAME=<approved-template-name>
WHATSAPP_AUTH_TEMPLATE_LANGUAGE=<template-language-code>
```

Notes:
- `WHATSAPP_OTP_TEMPLATE_*` is preferred.
- Code fallback supports legacy `WHATSAPP_AUTH_TEMPLATE_*`.
- Never store raw tokens in git/docs/screenshots.

---

## 3) Token Rotation and Expiry Policy

Policy:

1. Use **System User Permanent Access Token** only.
2. Rotate token immediately after any accidental disclosure.
3. Keep previous token valid only during short cutover window.
4. After cutover, revoke old token.
5. Re-run diagnostics and message smoke after rotation.

Rotation steps:

1. Meta Business Settings -> System Users -> Generate New Token.
2. Update `WHATSAPP_ACCESS_TOKEN` in production secrets manager.
3. Trigger deploy/restart.
4. Verify:
   - `/api/whatsapp/diagnose`
   - test template send.
5. Revoke old token in Meta UI.

---

## 4) Template Contract (Current Approved Template)

Current approved template for testing:
- Name: `kezek_test`
- Category: `UTILITY`
- Language: `ru` (or `ru_RU`, match exact manager value)
- Required body parameters: `3`

Parameter order for `kezek_test`:
- `{{1}}` recipient name
- `{{2}}` address/details
- `{{3}}` contact/support

Important:
- Mobile OTP flow should use a dedicated OTP template with exactly `1` variable (`{{1}}` = code).
- If `kezek_test` is used with only one parameter, Meta returns:
  - `(#132000) Number of parameters does not match`.

---

## 5) Security Notes

- Treat any token shared in chat/logs as compromised.
- Mask secrets in logs (`whatsapp_access_token`, `authorization`).
- Keep OTP and phone data masked in application logs.

---

## 6) Utility -> Authentication Migration

Migration checklist:
- `docs/MOBILE_WHATSAPP_AUTH_TEMPLATE_MIGRATION_CHECKLIST.md`

Current implementation details:
- Template name is configurable via env, not hardcoded in business logic.
- Preferred env:
  - `WHATSAPP_OTP_TEMPLATE_NAME`
  - `WHATSAPP_OTP_TEMPLATE_LANG`
- Backward compatible fallback:
  - `WHATSAPP_AUTH_TEMPLATE_NAME`
  - `WHATSAPP_AUTH_TEMPLATE_LANGUAGE`
