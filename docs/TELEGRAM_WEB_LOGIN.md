# Browser-bound Telegram bot login

## Status

Implemented behind `NEXT_PUBLIC_TELEGRAM_BOT_LOGIN_ENABLED=true`. **Off by default.**
Migration `20260917130000_telegram_web_login_attempts.sql` was tested in disposable
PostgreSQL and applied on 2026-09-17 to `beulnmftzbmtbdlgurht` with explicit user
approval. Ledger entry recorded; empty table, RLS enabled, anon read/user write/user
RPC denied, service RPC allowed verified after application. No profiles/auth rows changed.
Enabled only in ignored local `telegram-test.env.local`; production app not deployed.
Current local URL: `https://frontpage-fifteen-rebate-rotation.trycloudflare.com`.
Local server/tunnel had stopped; restarted and test bot webhook updated to this URL.
Browser smoke: new button, code and bot link rendered; test request cancelled without
Telegram approval/session creation. Full login awaits the user's real Telegram confirmation.

## Scope

Signs in to an existing profile with a verified Telegram binding. Does not create
new users, merge/reassign profiles, reset passwords, or modify notification preferences.
An unlinked Telegram user is instructed to sign in another way and connect it in
the profile. Signup through the new bot flow is deliberately not part of this release.
The old widget remains the fallback while the flag is off. Mobile auth and profile
linking retain their separate protocols.

## Protocol

- POST `/api/auth/telegram/web-login`: create/status/cancel/finish. Same-origin HTTPS
  required; separate route rate limits for create and poll. Responses use no-store.
- Create generates independent random 192-bit bot token and browser secret. Only
  SHA-256 hashes are stored. Browser secret is in a Secure, HttpOnly, SameSite=Strict,
  host-only cookie; it is never sent to Telegram or returned in JSON.
- Bot payload prefix `kw1_` and callback prefix `kw1:` are distinct from `kl1_`
  profile links and mobile payloads. The shared webhook authenticates its secret
  before routing. Private chat and matching sender/chat IDs required.
- First Telegram actor claims the request; a different actor cannot approve it.
  The bot shows a comparison code and an explicit warning against unsolicited links.
- Only after Telegram consent can the initiating browser see the Telegram account.
  The user confirms that account in the browser before finishing. Codes are UI
  comparison hints, not authentication credentials.
- Atomic SQL consumption validates browser, actor, consent, TTL and current verified
  profile binding. Replays fail; concurrent finish calls have at most one winner.
- On successful consumption, server-side Supabase `generateLink` + `verifyOtp`
  establish a session for exactly the returned user ID. No email is sent. Session
  tokens and generated links never appear in JSON, bot messages or application logs.
  Cookie writes are attached only after verifying the expected user ID.
- If session creation fails after consumption, start again. Do not retry session
  issuance for the consumed attempt. A lost HTTP response may require a new request.
- New requests replace the browser cookie, invalidating access to older requests
  in other tabs. Requests expire after five minutes; cancellation closes them early.

## Deployment / verification

1. Obtain explicit approval for the new table, index and service-only transition
   function in the working database. Migration does not update profiles/auth users.
2. Apply only the named migration using the project's migration process. Verify RLS
   and grants; anonymous/authenticated roles have neither reads nor RPC execution.
3. Enable flag locally in `telegram-test.env.local`, restart via the existing launcher.
   Keep production flag off until separate rollout approval. No BotFather `/setdomain`
   required for this new flow; a valid webhook URL/secret is still required.
4. Manually test existing linked user, other Telegram account, unlinked account,
   cancel in browser/bot, expiry, repeated callbacks, two tabs and reload.
5. Verify existing Yandex login/profile links and notification delivery are unaffected.
6. Schedule service-role cleanup of attempts with `expires_at < now() - interval '1 day'`
   through the existing maintenance process before production rollout. TTL remains
   enforced even before cleanup is scheduled. No new cron is installed by this migration.

Tests: `scripts/test-telegram-web-login-db.mjs` (PGlite, no external DB),
`telegramWebLoginHttpService.test.ts`, `telegramWebLoginWebhookService.test.ts`,
`TelegramBotLogin.test.tsx`, plus shared webhook authentication regression tests.
