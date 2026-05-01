# Mobile WhatsApp Auth ADR

## Status

Accepted (MVP).

## Date

2026-04-30

## Context

We need mobile login via WhatsApp without web-widget dependency. Business verification is still in progress, and current Meta account permissions allow `UTILITY` template creation/sending, while `AUTHENTICATION` template creation is restricted.

## Decision

1. Implement WhatsApp mobile OTP login now using approved `UTILITY` template.
2. Keep provider contract configurable by environment:
   - `WHATSAPP_OTP_TEMPLATE_NAME`
   - `WHATSAPP_OTP_TEMPLATE_LANG`
3. Design backend/mobile flow independent from template category.
4. After business verification and permissions are ready, switch to `AUTHENTICATION` template by config and minimal payload adjustment.

## UX Flow (MVP)

1. User enters phone number.
2. App requests OTP delivery through WhatsApp template.
3. App shows OTP input with resend cooldown.
4. User enters OTP and app verifies.
5. Backend returns exchange/session data and app signs user in.

## Fallback UX

If WhatsApp delivery/verification fails:

1. Show explicit error state (`network`, `provider unavailable`, `too many attempts`, `expired`, `wrong code`).
2. Offer retry/resend when allowed.
3. Offer return to alternative methods (Telegram/Google/email if enabled).

## Trade-offs

### `UTILITY` now

Pros:
- No blocking on business verification completion.
- Fastest path to production value.

Cons:
- Less specialized semantics compared to `AUTHENTICATION` templates.
- Potentially stricter manual moderation of generic template copy.

### `AUTHENTICATION` later

Pros:
- Native OTP semantics in WhatsApp ecosystem.
- Better long-term compliance for verification messaging.

Cons:
- Depends on Meta permissions/business verification.
- Requires controlled migration and regression checks.

## Consequences

- MVP can launch with current account state.
- Migration to `AUTHENTICATION` is planned as config-first change, not a full rewrite.
- Observability and security controls remain mandatory regardless of template category.

## Rollback

- Disable `mobile_whatsapp_auth` feature flag.
- Keep existing login methods as primary path.
