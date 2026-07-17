# WEB BUG REGISTRY

Last updated: 2026-07-17
Owner: User + Codex  
Status: Active

## Purpose

This registry contains defects reproduced during live testing of the Kezek web application.

Mobile-only defects remain in [MOBILE_BUG_REGISTRY.md](./MOBILE_BUG_REGISTRY.md).
The web testing scope and execution status are maintained in
[WEB_LIVE_TESTING_AREAS_CATALOG.md](./WEB_LIVE_TESTING_AREAS_CATALOG.md).

## Status values

- `open`
- `in progress`
- `fixed`
- `verified`
- `cannot reproduce`
- `accepted risk`

## Severity

- `P0`: release blocker, security/tenant boundary, data loss, critical workflow unavailable, or incorrect financial result.
- `P1`: major workflow or resilience defect without a safe practical workaround.
- `P2`: presentation, accessibility, browser compatibility, or lower-impact edge case.

## Bug template

```markdown
### WB-001
- id: `WB-001`
- date: `YYYY-MM-DD`
- area: `C3`
- severity: `P0 | P1 | P2`
- title: Short defect title
- build: commit/deploy URL
- environment: browser, OS, viewport, role
- preconditions:
  - ...
- steps:
  1. ...
- expected:
  - ...
- actual:
  - ...
- evidence:
  - screenshot/snapshot/console/network trace
- status: `open`
- owner: `Codex + User`

```

## Open bugs

### WB-047
- id: `WB-047`
- date: `2026-07-16`
- area: `Admin / business members`
- severity: `P1`
- title: Admin business members page remains stuck loading and throws a React hydration error
- build: production `https://kezek.kg` after commit `f291f309`
- environment: in-app Chromium, production `https://kezek.kg`, authenticated super-admin session, desktop viewport
- preconditions:
  - An authenticated business application has been approved and its business was created.
  - Super-admin can open the created business in admin.
- steps:
  1. Open the created business detail in `/admin/businesses`.
  2. Open its `members` page.
  3. Wait for the participants list to load.
- expected:
  - The participants list loads and displays the automatically assigned owner.
  - The page has no hydration or Server Component errors.
- actual:
  - The page remains on `Загрузка участников...` and does not render the participants list.
  - Browser console reports `Minified React error #418` from a production Next.js chunk.
- evidence:
  - Live DOM snapshot from `https://kezek.kg/admin/businesses/481ec1e2-287c-435a-9f98-d5b003dec4a7/members`.
  - Browser console error: `Minified React error #418`.
  - The application approval page and business detail page had no console errors; the failure reproduces on the members page.
- fix:
  - removed server-derived absolute API origin from the client component;
  - members requests now use same-origin relative URLs, avoiding incorrect `x-forwarded-proto`/host combinations and mixed-origin client requests.
- verification:
  - local `pnpm --filter web exec tsc --noEmit` passed;
  - local `pnpm -C apps/web build` passed;
  - production post-fix live verification pending deployment.
- status: `fixed`
- owner: `Codex + User`

### WB-046
- id: `WB-046`
- date: `2026-07-16`
- area: `Admin / business registration applications`
- severity: `P0`
- title: Approving a business registration application does not create a business
- build: production `https://kezek.kg` after commit `3dd62fee`
- environment: in-app Chromium, production `https://kezek.kg`, super-admin session, desktop viewport
- preconditions:
  - Production site is deployed.
  - Super-admin can open `/admin/business-applications`.
  - Public business application form is available at `/business/apply`.
- steps:
  1. Open `https://kezek.kg/business/apply` as a guest.
  2. Submit a test application with business name `LIVE TEST Business 20260715111633`.
  3. Open `https://kezek.kg/admin/business-applications` as super-admin.
  4. Find the test application.
  5. Click `Одобрить`.
  6. Open `https://kezek.kg/admin/businesses`.
  7. Search/inspect whether the approved business exists.
- expected:
  - Approving the application either creates a draft/approved business record from the application data or clearly routes the admin through the required business creation flow.
  - The application approval state and created business state remain linked and understandable.
- actual:
  - The application status changes from `new` to `approved`.
  - No business named `LIVE TEST Business 20260715111633` appears in `/admin/businesses`.
  - Public search API for the same name returns `{"ok":true,"items":[]}`.
- evidence:
  - Live browser success after public submit: `Заявка отправлена`.
  - Live admin page before approval: application `LIVE TEST Business 20260715111633`, status `new`, buttons `Связались`, `Одобрить`, `Отклонить`.
  - Live admin page after approval: same application status `approved`, browser console errors: none observed.
  - Live admin businesses page after approval: total still `4`, test business absent.
  - HTTP check: `GET https://kezek.kg/api/businesses/search?q=LIVE%20TEST%20Business%2020260715111633` returned `{"ok":true,"items":[]}`.
- fix:
  - added `business_registration_applications.created_business_id`;
  - changed super-admin `approved` action to create an approved business from the application data;
  - generated a unique business slug from the application business name;
  - copied city to business address, phone to business phones, category to a matching active category with safe fallback;
  - linked the application to the created business and made repeat approval idempotent;
  - updated the admin UI to show `Одобрить и создать бизнес` and a link to the created business.
- verification:
  - local TypeScript check passed;
  - local production build passed;
  - migration `20260716010000_link_business_registration_applications.sql` applied to production Supabase;
  - production post-fix live test on `https://kezek.kg` completed 2026-07-16;
  - super-admin approved the existing safe test application using `Одобрить и создать бизнес`;
  - the application showed `Открыть созданный бизнес` and linked to business `3d71f584-ef14-4bcd-aecd-cd7041e82622`;
  - `/admin/businesses` showed `LIVE TEST Business 20260715111633` with slug `live-test-business-20260715111633`;
  - browser console errors: none observed.
  - additional authenticated-applicant live test completed 2026-07-16;
  - super-admin approved `LIVE AUTH Business 2026071618045` using `Одобрить и создать бизнес`;
  - the created business detail displayed a populated owner matching the authenticated applicant, confirming automatic owner assignment;
  - browser console errors: none observed on the application approval and business detail pages;
  - the separate members-page loading/hydration failure is tracked as `WB-047`.
- status: `verified`
- owner: `Codex + User`

### WB-045
- id: `WB-045`
- date: `2026-07-14`
- area: `Supabase production hardening / admin authorization`
- severity: `P0`
- title: Admin business applications page is accessible to a user without any admin/global/business roles
- build: `kezek.kg` production after Stage 1 Supabase schema sync
- environment: production `https://kezek.kg`, authenticated Google user `osorovadahan04@gmail.com`
- preconditions:
  - User is authenticated.
  - Production DB role check for `osorovadahan04@gmail.com` returns:
    - `global_roles: []`
    - `business_roles: []`
    - `profile_exists: false`
    - `is_super_admin_function: false`
- steps:
  1. Log in to production as `osorovadahan04@gmail.com`.
  2. Open `https://kezek.kg/admin/business-applications` directly.
  3. Observe the rendered admin page.
- expected:
  - User without superadmin/admin role is denied or redirected to a safe no-access page.
  - Business application admin surfaces are not rendered to unprivileged users.
- actual:
  - Page renders `Админка` and `Заявки на регистрацию бизнеса`.
  - It shows the empty applications state instead of denying access.
- evidence:
  - Live browser text: `Админка`, `Заявки на регистрацию бизнеса`, `Заявок пока нет.`
  - Production DB read-only role check: `global_roles=[]`, `business_roles=[]`, `profile_exists=false`.
  - Browser console errors: none observed.
- fix:
  - changed admin layout super-admin guard to scope the `user_roles_with_user` lookup by current `user.id`;
  - added regression helper/test to assert the super-admin lookup includes `eq('user_id', currentUserId)`.
- verification:
  - 2026-07-14 live production post-fix check on `https://kezek.kg/admin/business-applications` as `osorovadahan04@gmail.com` shows the no-access page:
    - `ДОСТУП ОГРАНИЧЕН`
    - `Нужны права супер-админа`
    - current account displayed as `osorovadahan04@gmail.com`
    - required role displayed as `global super_admin`
  - Browser console errors during post-fix check: none observed.
  - local Jest execution is currently blocked because `pnpm` reports a frozen lockfile/overrides mismatch and direct Jest execution fails with missing `apps/web/node_modules/jest/bin/jest.js` after the interrupted dependency install.
- status: `verified`
- owner: `Codex + User`

### WB-034
- id: `WB-034`
- date: `2026-07-04`
- area: `C4-C5 / cabinet social connections and notification channels`
- severity: `P0`
- title: Contact phone is reused as WhatsApp identity, causing misleading UI and unsafe notification/login ownership
- build: deployed production `https://kezek.kg` after commit `95618fef`
- environment: in-app Chromium, Windows, authenticated cabinet profile
- preconditions:
  - open `/cabinet/profile` with an authenticated user
- steps:
  1. Enter a value in the top-level `Телефон` field in personal data.
  2. Inspect the helper and warning text.
  3. Inspect the WhatsApp connection row in `Способы входа`.
  4. Consider a user who already has a different Kezek account created through another provider.
- expected:
  - the top-level phone is only a contact phone;
  - WhatsApp login/notifications use a separate verified WhatsApp identity phone;
  - changing contact phone does not reset WhatsApp verification;
  - a WhatsApp identity already linked to another Kezek account is not silently merged into the current account.
- actual:
  - the contact phone helper says it is needed for WhatsApp confirmation and contact;
  - WhatsApp OTP is sent using `profiles.phone`;
  - saving a changed contact phone resets `whatsapp_verified`;
  - WhatsApp notification delivery also risks using the contact phone instead of a verified WhatsApp identity.
- evidence:
  - user screenshot: `C:/Users/osoro/AppData/Local/Temp/codex-clipboard-4e1d271f-4be4-4812-a53e-18217190cd4a.png`
  - user screenshot: `C:/Users/osoro/AppData/Local/Temp/codex-clipboard-acd88b30-8048-478e-99b8-b923073b6235.png`
- fix:
  - added `profiles.whatsapp_phone` for WhatsApp identity/notifications;
  - backfilled existing verified WhatsApp phones from legacy `profiles.phone`;
  - moved WhatsApp OTP send/verify to use `whatsapp_phone` through short-lived OTP metadata;
  - contact phone updates no longer reset WhatsApp verification;
  - WhatsApp notifications use `whatsappPhone`, not contact `phone`;
  - updated cabinet UI copy and added an explicit warning that already-linked provider identities are not auto-merged.
- verification:
  - `pnpm -C apps/web typecheck` passed;
  - targeted ESLint passed;
  - focused profile/WhatsApp send/verify/login tests passed: `28 passed`;
  - production post-fix live verification requires deploy and database migration.
- status: `fixed locally; production post-fix live verification required`
- owner: `Codex + User`

### WB-033
- id: `WB-033`
- date: `2026-07-04`
- area: `C4-C5 / cabinet social connections`
- severity: `P0`
- title: Social connection screen does not actually support multi-provider account linking and enables unavailable notification channels
- build: deployed production `https://kezek.kg` at commit `11601622`
- environment: in-app Chromium, Windows, authenticated Google user
- steps:
  1. Open `/cabinet/profile` after signing in with Google.
  2. Inspect Google, Yandex, Telegram, and WhatsApp in “Способы входа”.
  3. Try to connect another sign-in provider.
  4. Inspect Telegram and WhatsApp notification switches while those channels are disconnected.
- expected:
  - every disconnected provider has a real account-link action that binds it to the current Kezek user;
  - signing in through any linked provider returns the same profile;
  - notification preferences are separate and cannot be enabled before their channel is connected.
- actual:
  - the section only displays statuses; Google and Yandex cannot be linked from the cabinet;
  - Telegram and WhatsApp notification switches appear enabled while the corresponding identities are disconnected;
  - the explanatory copy incorrectly mixes sign-in identity linking with notification setup.
- evidence:
  - production screenshot: `C:/Users/osoro/AppData/Local/Temp/codex-clipboard-0e8b3486-a883-4b72-94a9-12b1d5ec3792.png`
- fix:
  - added real Google identity linking through Supabase identity linking;
  - enabled Supabase manual identity linking in project auth configuration;
  - added authenticated Yandex linking with a short-lived HttpOnly state cookie, ownership conflict handling, and no replacement session;
  - kept Telegram signed-payload linking and moved WhatsApp OTP verification into the sign-in connection section;
  - separated notification preferences from login identities in the UI;
  - disabled Telegram/WhatsApp notification switches until their identities are connected and enforced the same rule server-side;
  - normalized verified WhatsApp phone ownership and added unique database indexes for Yandex and verified WhatsApp identities.
- verification:
  - focused identity/callback/profile/WhatsApp suites: `15 passed`;
  - web typecheck, targeted lint, and production build passed;
  - unauthenticated Yandex link start returned safe HTTP 401 on the local production server;
  - full provider completion and same-account post-login checks require deployment because OAuth providers return to `kezek.kg`.
- status: `fixed locally; production post-fix live verification required`
- owner: `Codex + User`

### WB-032
- id: `WB-032`
- date: `2026-07-04`
- area: `C4 / cabinet social connections`
- severity: `P0`
- title: A WhatsApp-verified profile can receive a separate duplicate account on WhatsApp sign-in
- build: deployed production `https://kezek.kg` and local source at commit `6cc2343b`
- environment: source-confirmed against the live profile and sign-in flows; Chromium on Windows
- preconditions:
  - an existing Google, Yandex, or Telegram user has a phone stored and WhatsApp-verified in `profiles`
- steps:
  1. Verify a WhatsApp number from `/cabinet/profile`.
  2. Sign out and authenticate through `/auth/whatsapp` with the same number.
  3. Observe how the WhatsApp login service resolves account ownership.
- expected:
  - a verified phone maps WhatsApp sign-in to the same profile exactly once.
- actual:
  - login searches only Auth user phone/metadata and ignores the verified `profiles.phone` owner;
  - when the social user has no Auth phone, the service can create a second user for the same person.
- evidence:
  - live production profile has the social notification/linking surface;
  - `whatsAppAuthVerifyOtpService.ts` resolves users only through `auth.admin.listUsers()` before create.
- fix:
  - WhatsApp login now checks the unique WhatsApp-verified profile owner before creating an Auth user;
  - the existing profile owner is reused and marked in Auth metadata for subsequent sign-ins;
  - ambiguous duplicate ownership and lookup failures stop safely without creating another account.
- verification:
  - focused WhatsApp login/send/OTP tests passed, including a regression test proving no user is created for a verified social profile;
  - typecheck and production build passed;
  - production post-fix live verification requires deployment.
- status: `fixed locally; production post-fix live verification required`
- owner: `Codex + User`

### WB-031
- id: `WB-031`
- date: `2026-07-04`
- area: `C4 / cabinet social connections`
- severity: `P1`
- title: WhatsApp notification connection is implemented but permanently hidden in the profile UI
- build: deployed production `https://kezek.kg` at commit `6cc2343b`
- environment: in-app Chromium, Windows, authenticated user
- preconditions:
  - open `/cabinet/profile`
- steps:
  1. Open the notification settings.
  2. Look for WhatsApp notification setup and number verification.
- expected:
  - the user can enable WhatsApp notifications and verify the saved phone with an OTP.
- actual:
  - only Email and Telegram are rendered;
  - the complete WhatsApp toggle/OTP UI is wrapped in a constant `{false && (...)}` condition.
- evidence:
  - production DOM snapshot on `2026-07-04` contains Email and Telegram but no WhatsApp control;
  - source evidence: `apps/web/src/app/cabinet/components/ProfileForm.tsx`.
- fix:
  - restored the WhatsApp notification toggle and OTP verification UI;
  - added a separate login-connections overview for Google, Yandex, Telegram, and WhatsApp;
  - provider status is derived from authenticated identities and verified profile ownership;
  - OTP sending is blocked while a changed phone number is still unsaved, avoiding verification of stale profile data.
- verification:
  - production baseline reproduced with only Email and Telegram controls;
  - typecheck, focused tests, lint, and production build passed locally;
  - authenticated local UI could not be exercised because configured Google OAuth returned to `kezek.kg`;
  - production post-fix live verification requires deployment.
- status: `fixed locally; production post-fix live verification required`
- owner: `Codex + User`

### WB-030
- id: `WB-030`
- date: `2026-07-04`
- area: `I1 / emergency branch creation`
- severity: `P1`
- title: Branch creation is blocked when Yandex Maps key is unavailable and owners are denied create access
- build: deployed production `https://kezek.kg` at commit `fb7b5ef9`
- environment: Chromium on Windows; super-admin screenshot and authenticated business-owner flow
- preconditions:
  - open a branch creation form
- steps:
  1. Open `/admin/businesses/[id]/branches/new` on production.
  2. Observe the map initialization failure when the public Yandex Maps key is unavailable.
  3. Attempt to enter an address or submit without map coordinates.
  4. Open `/dashboard/branches` and `/dashboard/branches/new` as a business owner.
- expected:
  - map receives runtime configuration when available;
  - branch can still be created with a manual address when map/coordinates are unavailable;
  - an owner can create a branch only for their own selected business.
- actual:
  - map exposes an internal missing-env message;
  - address is read-only and admin create API requires coordinates, blocking submission;
  - dashboard create UI and API allow only super-admin, denying the owner.
- evidence:
  - screenshot: `C:/Users/osoro/AppData/Local/Temp/codex-clipboard-046bdd3e-42be-44d0-bfd5-ad924616f8a1.png`
- fix:
  - branch forms now receive the runtime Yandex Maps key when available;
  - map failures show safe user guidance instead of internal environment details;
  - address is editable manually and branch creation accepts missing coordinates;
  - dashboard list, create page, and create API allow the authenticated owner of the selected business while continuing to deny unrelated managers.
- verification:
  - owner/super-admin/forbidden authorization and coordinate-optional service tests passed;
  - web typecheck and production build passed;
  - production post-fix live verification requires deployment.
- status: `fixed locally; production post-fix live verification required`
- owner: `Codex + User`

### WB-029
- id: `WB-029`
- date: `2026-07-03`
- area: `C4`
- severity: `P0`
- title: Telegram linking payload remains in the profile URL fragment when the link request is rate-limited
- build: deployed commit `fb7b5ef9` at `https://kezek.kg`
- environment: in-app Chromium, Windows, authenticated Yandex user, real Telegram identity
- preconditions:
  - open the Telegram linking widget from `/cabinet/profile`
- steps:
  1. Authenticate with Telegram and click the final `Войти как …` action.
  2. Trigger the link request while the auth rate limit is active.
  3. Observe the profile address bar and retry feedback.
- expected:
  - Telegram callback data is removed from the URL immediately, regardless of API success or failure;
  - rate-limit feedback is safe and the identity is not partially linked.
- actual:
  - the API shows a localized retry countdown, but the signed Telegram payload remains in `#tgAuthResult`;
  - profile and reminder continue to show Telegram as unlinked.
- evidence:
  - real production browser reproduction on `2026-07-03`; payload values intentionally omitted
- fix:
  - both Telegram login and linking widgets now remove `#tgAuthResult` with `history.replaceState` before making any API request.
- verification:
  - focused fragment/link/login tests, typecheck, and production build passed locally;
  - production post-fix live verification requires deployment.
- status: `fixed locally; production post-fix live verification required`
- owner: `Codex + User`

### WB-028
- id: `WB-028`
- date: `2026-07-03`
- area: `C4`
- severity: `P0`
- title: Telegram reminder cannot link an already authenticated account because sign-in immediately redirects away
- build: deployed commit `fb7b5ef9` at `https://kezek.kg`
- environment: in-app Chromium, Windows, authenticated Yandex session
- preconditions:
  - user is authenticated and the Telegram reminder banner is visible
- steps:
  1. Open `/cabinet/bookings`.
  2. Click reminder action `Подключить`.
  3. Observe `/auth/sign-in?redirect=/cabinet` and wait for the Telegram widget.
- expected:
  - Telegram confirmation remains available and links the identity to the current Kezek user exactly once.
- actual:
  - the widget appears briefly, then existing-session routing returns to `/cabinet/bookings` before it can be used;
  - reminder remains visible and no linking occurs.
- evidence:
  - real production browser reproduction on `2026-07-03`; console clean
- fix:
  - reminder action now opens `/cabinet/profile`, where the authenticated linking widget calls `/api/auth/telegram/link`.
- verification:
  - focused Telegram link/login tests, typecheck, and production build passed locally;
  - production post-fix live verification requires deployment.
- status: `fixed locally; production post-fix live verification required`
- owner: `Codex + User`

### WB-027
- id: `WB-027`
- date: `2026-07-03`
- area: `C3`
- severity: `P0`
- title: Real Google OAuth reaches the deployed callback but ends on the authorization error surface
- build: deployed commit `0f57fd8d` at `https://kezek.kg`
- environment: in-app Chromium, Windows, real Google identity, clean Kezek production session
- steps:
  1. Open `/auth/sign-in?next=%2Fcabinet` on production.
  2. Click `Продолжить с Google` and complete the provider flow.
  3. Wait on `/auth/callback`.
- expected:
  - the callback establishes one session and replaces itself with `/cabinet` or the role-policy destination.
- actual:
  - callback receives `code`, `from`, and `next`, then renders `Не удалось завершить авторизацию`;
  - no redirect loop occurs and no raw provider error is exposed.
- evidence:
  - post-deploy live browser run on `2026-07-03`; authorization code intentionally omitted
- suspected cause:
  - automatic Supabase PKCE handling and explicit `exchangeCodeForSession` can race; an already-created session is not accepted when the explicit exchange reports an error.
- fix:
  - Google now returns to a dedicated server Route Handler that exchanges the PKCE code and writes auth cookies before redirecting to the existing role-routing callback;
  - the browser callback no longer owns the initial Google code exchange.
- verification:
  - typecheck and production build passed locally;
  - deployed commit `fb7b5ef9` completed real Google OAuth through the server callback;
  - role policy sent the multi-business owner to `/select-business`, reload preserved the session, and Back did not restore callback data.
- post-fix evidence:
  - `apps/web/test-results/live-c3-oauth-2026-07-03/c3-postdeploy-final-sanitized.json`
- status: `verified`
- owner: `Codex + User`

### WB-026
- id: `WB-026`
- date: `2026-07-03`
- area: `C3`
- severity: `P1`
- title: OAuth cancellation returns to sign-in without any user feedback
- build: current local production candidate at `http://localhost:3000`
- environment: in-app Chromium, Windows, guest local Kezek session
- steps:
  1. Return from a provider callback with `error=access_denied`.
  2. Observe `/auth/sign-in?error=access_denied`.
- expected:
  - sign-in explains that authorization was cancelled and offers another attempt/provider.
- actual:
  - the normal sign-in screen appears with no error or cancellation feedback.
- evidence:
  - `apps/web/test-results/live-c3-oauth-2026-07-03/c3-yandex-cancellation.json`
- fix:
  - added safe OAuth error mapping and rendered cancellation feedback on sign-in without exposing raw provider codes.
- post-fix live verification:
  - controlled `access_denied` callback returned to sign-in with `Вход отменён…` feedback;
  - raw provider code was absent from UI, console was clean, and no horizontal overflow appeared.
- post-fix evidence:
  - `apps/web/test-results/live-c3-oauth-2026-07-03/c3-yandex-cancellation-postfix.json`
- status: `verified`
- owner: `Codex + User`

### WB-025
- id: `WB-025`
- date: `2026-07-03`
- area: `C3`
- severity: `P0`
- title: Yandex OAuth callback with sensitive auth fragment remains reachable through browser Back
- build: deployed callback at `https://kezek.kg`, reached from the local production candidate
- environment: in-app Chromium, Windows, authenticated real Yandex ID
- preconditions:
  - complete Yandex OAuth and reach `/cabinet/bookings`
- steps:
  1. Reload the destination and confirm the session persists.
  2. Press browser Back once.
- expected:
  - callback history is replaced after session establishment;
  - browser history never exposes reusable authentication material.
- actual:
  - Back returns to `/auth/callback` with sensitive authentication values in the URL fragment;
  - Forward returns to the cabinet and the session remains usable.
- evidence:
  - `apps/web/test-results/live-c3-oauth-2026-07-03/c3-yandex-postfix-live.json` (all sensitive values redacted)
- fix:
  - local production candidate now completes all generic auth callback branches with `window.location.replace(targetPath)` instead of adding a history entry.
  - follow-up candidate also replaces `/auth/callback-yandex` with its API callback instead of adding the Yandex authorization code to browser history.
- post-deploy observation for commit `0f57fd8d`:
  - sensitive auth fragments no longer remain after generic callback completion;
  - session persists and replay is idempotent, but Back can still briefly reopen `/auth/callback-yandex` with a one-time code.
- final post-fix live verification:
  - deployed commit `fb7b5ef9` completed real Yandex OAuth at `/cabinet/bookings`;
  - reload preserved the session;
  - Back returned to the clean sign-in history entry without callback code or auth fragment, then session routing restored `/cabinet/bookings`.
- post-fix evidence:
  - `apps/web/test-results/live-c3-oauth-2026-07-03/c3-postdeploy-final-sanitized.json`
- status: `verified`
- owner: `Codex + User`

### WB-024
- id: `WB-024`
- date: `2026-07-03`
- area: `C3`
- severity: `P0`
- title: Yandex OAuth is rejected because localhost redirect URI does not match the registered Callback URL
- build: current local production candidate at `http://localhost:3000`
- environment: in-app Chromium, Windows, real Yandex ID authorization
- preconditions:
  - Yandex OAuth is enabled and the user is signed out of Kezek
- steps:
  1. Open local `/auth/sign-in?next=%2Fcabinet`.
  2. Click `Войти через Яндекс` and authenticate with a real Yandex ID.
  3. Observe the provider response.
- expected:
  - the authorization request uses the exact registered release callback and returns to Kezek.
- actual:
  - Yandex responds with HTTP 400: `redirect_uri` does not match the Callback URL registered for the application;
  - the request sends `http://localhost:3000/auth/callback-yandex`.
- evidence:
  - real provider page at `oauth.yandex.ru/authorize` on `2026-07-03`; query values intentionally omitted
- fix:
  - introduced an explicit `NEXT_PUBLIC_YANDEX_REDIRECT_URI` contract shared by authorization and token exchange;
  - release fallback is `https://kezek.kg/auth/callback-yandex` instead of deriving the callback from localhost public origin.
- post-fix live verification:
  - real Yandex authorization accepted the corrected callback, reached production `/auth/callback-yandex`, and completed at `/cabinet/bookings`;
  - the resulting session survived direct reload and browser console was clean.
- post-fix evidence:
  - `apps/web/test-results/live-c3-oauth-2026-07-03/c3-yandex-postfix-live.json`
- status: `verified`
- owner: `Codex + User`

### WB-023
- id: `WB-023`
- date: `2026-07-03`
- area: `C3`
- severity: `P1`
- title: Google OAuth loses the requested return path and leaves the callback code on the destination URL
- build: current local production candidate at `http://localhost:3000`; OAuth completion on `https://kezek.kg`
- environment: in-app Chromium, Windows, guest local Kezek session with an existing Google provider session
- preconditions:
  - open `/auth/sign-in?next=%2Fcabinet` on the local production build
- steps:
  1. Click `Продолжить с Google`.
  2. Complete/allow the Google provider flow.
  3. Observe the final Kezek route and address bar.
- expected:
  - OAuth returns through the configured callback for the initiating origin;
  - the safe `next=/cabinet` destination is preserved;
  - transient authorization codes are removed from the visible destination URL after exchange.
- actual:
  - the flow completed on production `/select-cabinet` instead of the requested `/cabinet`;
  - the final visible URL retained a transient `code` query parameter.
- evidence:
  - live browser reproduction on `2026-07-03`; code value intentionally omitted
  - `apps/web/test-results/live-c3-oauth-2026-07-03/c3-google-live-sanitized.json`
- fix:
  - Google authorization now includes the sanitized return path in its callback URL;
  - generic callback completion now uses `window.location.replace` so transient callback URLs are removed from browser history.
- post-fix live verification:
  - deployed commit `fb7b5ef9` preserved the safe return intent through the dedicated Google callback;
  - final destination followed role policy (`/select-business` for the tested multi-business owner);
  - no callback code remained in the destination or Back history.
- post-fix evidence:
  - `apps/web/test-results/live-c3-oauth-2026-07-03/c3-postdeploy-final-sanitized.json`
- status: `verified`
- owner: `Codex + User`

### WB-022
- id: `WB-022`
- date: `2026-07-03`
- area: `C1/C2`
- severity: `P1`
- title: Sign-in UI exposes unsupported e-mail magic-link and password-recovery flows
- build: current local production candidate with uncommitted live-testing fixes
- environment: `http://localhost:3000`, in-app Chromium, Windows, guest
- preconditions:
  - product authentication policy allows social providers only
- steps:
  1. Open `/auth/sign-in` as a guest.
  2. Observe the primary e-mail field and `Отправить код` action.
  3. Direct-load `/auth/reset-password`, `/auth/update-password`, and `/auth/verify-email`.
- expected:
  - only Google, Yandex, WhatsApp, and Telegram authentication entry points are offered;
  - unsupported e-mail/password routes do not expose functional forms.
- actual:
  - e-mail magic-link was presented as the first sign-in option;
  - reset-password, update-password, and verify-email routes were publicly reachable.
- evidence:
  - live browser reproduction on `/auth/sign-in` and `/auth/reset-password` (`2026-07-03`)
- fix:
  - removed the e-mail/OTP form and submission logic from the sign-in page;
  - changed unsupported reset/update/verify-email entry routes to server redirects to `/auth/sign-in`;
  - updated sign-in guidance to describe social authentication only.
- post-fix live verification:
  - local production build (`next build` + `next start`) on `2026-07-03`;
  - `/auth/sign-in` contains no e-mail/password input or e-mail OTP copy and exposes Google, Yandex, WhatsApp, and Telegram states;
  - `/auth/reset-password`, `/auth/update-password`, and `/auth/verify-email` all finish at `/auth/sign-in`;
  - desktop/mobile checks had no horizontal overflow and browser console warnings/errors were empty.
- post-fix evidence:
  - `apps/web/test-results/live-c2-social-only-2026-07-03/c2-social-only-postfix-live.json`
  - `apps/web/test-results/live-c2-social-only-2026-07-03/c2-social-only-final-live.json`
- status: `verified`
- owner: `Codex + User`

### WB-021
- id: `WB-021`
- date: `2026-06-30`
- area: `C2`
- severity: `P1`
- title: Email OTP and password recovery invalid paths expose raw provider errors and weak recovery UI
- build: current local production build (`next start`) with uncommitted A1-A4/B1-B4/C1 fixes
- environment: `http://localhost:3000`, in-app Chromium, Windows, guest, desktop viewport
- preconditions:
  - the web application is running locally at `http://localhost:3000`
  - the browser has no local authenticated Kezek session
- steps:
  1. Open `/auth/reset-password` and click `Отправить ссылку` with an empty value.
  2. Enter `not-an-email` and click `Отправить ссылку`.
  3. Open `/auth/update-password` without a recovery session and click `Сменить пароль`.
  4. Enter a short password and click `Сменить пароль` again.
  5. Open `/auth/verify?mode=email&email=test%40example.com&redirect=%2Fcabinet`, enter `000000`, and submit.
  6. Click `Повторно отправить код`.
- expected:
  - Invalid, expired, unauthenticated, or rate-limited auth states show localized, understandable, non-sensitive recovery guidance.
  - Empty/invalid input is blocked client-side where possible.
  - Invalid credentials never establish or promote a session.
  - Reset/update-password pages clearly explain the action and next recovery step.
- actual:
  - Reset-password has no heading/description, uses `type=text`, is not `required`, and sends empty/invalid values to Supabase.
  - Empty reset shows raw `Password recovery requires an email`.
  - Invalid reset shows raw `Unable to validate email address: invalid format`.
  - Update-password without a recovery session shows raw `Auth session missing!`; repeated clicks duplicate the raw toast.
  - Invalid email OTP shows raw `Token has expired or is invalid`.
  - Resend for an unknown/non-signup email shows raw `Signups not allowed for otp`.
- evidence:
  - live page record: `apps/web/test-results/live-c2-email-password-2026-06-30/c2-initial-pages.json`
  - live interaction record: `apps/web/test-results/live-c2-email-password-2026-06-30/c2-invalid-interactions.json`
- fix:
  - added localized, non-enumerating auth error mapping in `apps/web/src/lib/authUserMessages.ts`;
  - rebuilt reset-password and update-password recovery UI with native validation, explicit session gating, and safe recovery actions;
  - applied the same safe mapping to email OTP verification/resend and sign-in submission paths.
- post-fix live verification (`2026-06-30`, local production build):
  - empty and malformed email values are blocked by native validation;
  - reset requests use non-enumerating success feedback;
  - missing recovery sessions, invalid OTP, resend for an unknown address, and provider-side invalid-email failures show localized safe messages;
  - invalid paths did not establish a session; desktop/mobile console remained clean and no horizontal overflow was observed.
- post-fix evidence:
  - `apps/web/test-results/live-c2-email-password-2026-06-30/c2-postfix-desktop.json`
  - `apps/web/test-results/live-c2-email-password-2026-06-30/c2-request-link-code.json`
  - `apps/web/test-results/live-c2-email-password-2026-06-30/c2-final-live.json`
  - `apps/web/test-results/live-c2-email-password-2026-06-30/c2-reset-mobile-final.png`
- status: `verified; flow retired by social-only authentication policy on 2026-07-03`
- owner: `Codex + User`

### WB-020
- id: `WB-020`
- date: `2026-06-30`
- area: `C1`
- severity: `P1`
- title: Sign-in return URL handling drops `next` and accepts unsafe external redirects
- build: current local production build (`next start`) and deployed production `https://kezek.kg`
- environment: in-app Chromium, Windows, guest and authenticated Google session, desktop viewport
- preconditions:
  - the web application is running locally at `http://localhost:3000`
  - the browser has no local `localhost` Kezek session for the guest checks
  - the in-app browser has an authenticated production Google session for the existing-session check
- steps:
  1. Open `http://localhost:3000/auth/sign-in?next=%2Fb%2Fmanly%2Fbooking` as a guest.
  2. Inspect the WhatsApp login link and the page state.
  3. Open `http://localhost:3000/auth/sign-in?redirect=https%3A%2F%2Fevil.example%2Fafter-login` as a guest.
  4. Inspect the WhatsApp login link and the return URL propagated into sign-in state.
  5. Open `https://kezek.kg/auth/sign-in?redirect=%2Fb%2Fmanly%2Fbooking` as an authenticated user and wait for the role-policy redirect.
- expected:
  - `next` and `redirect` return URL aliases are handled consistently.
  - Only same-origin relative paths are accepted as post-auth return targets.
  - Unsafe absolute URLs are ignored or replaced with `/`.
  - Existing authenticated sessions redirect to the correct role-policy destination without a loop.
- actual:
  - `?next=/b/manly/booking` is ignored by the guest sign-in page; the WhatsApp link becomes `/auth/whatsapp?redirect=%2F`.
  - `?redirect=https://evil.example/after-login` is accepted and propagated into `/auth/whatsapp?redirect=...`.
  - The authenticated production session eventually redirects to `/select-business`, but the guest return URL handling is inconsistent and unsafe.
- evidence:
  - live browser state: `next` URL produced WhatsApp `redirect=%2F`
  - live browser state: external `redirect=https://evil.example/after-login` was preserved in the WhatsApp login link
  - production authenticated check redirected to `/select-business` with no console errors after waiting
- fix:
  - added shared `sanitizeAuthReturnPath` / `getAuthReturnPath` helpers for auth return URLs
  - made `/auth/sign-in` accept both `redirect` and `next` aliases while normalizing them to a safe relative path
  - sanitized callback, WhatsApp, verify, verify-email, Yandex sessionStorage, and final role-decision fallback return targets
  - blocked absolute, protocol-relative, empty, and backslash-based return URLs by falling back to `/`
- post-fix live verification:
  - rebuilt the production bundle and restarted `next start`
  - `http://localhost:3000/auth/sign-in?next=%2Fb%2Fmanly%2Fbooking` now renders the guest sign-in page with WhatsApp `redirect=%2Fb%2Fmanly%2Fbooking`
  - `http://localhost:3000/auth/sign-in?redirect=https%3A%2F%2Fevil.example%2Fafter-login` now renders the guest sign-in page with WhatsApp `redirect=%2F`
  - direct unsafe `/auth/whatsapp?redirect=https%3A%2F%2Fevil.example%2Fafter-login` renders safely with no visible external target
  - mobile `390x844` sign-in keeps the `next` return path, has no horizontal overflow, and emits no console warnings/errors
  - production authenticated `/auth/sign-in?redirect=%2Fb%2Fmanly%2Fbooking` redirects to `/select-business` with no loop or sign-in form
  - evidence:
    - `apps/web/test-results/live-c1-signin-2026-06-30/c1-postfix-desktop.json`
    - `apps/web/test-results/live-c1-signin-2026-06-30/c1-postfix-mobile.json`
    - `apps/web/test-results/live-c1-signin-2026-06-30/c1-validation-and-prod-session.json`
    - `apps/web/test-results/live-c1-signin-2026-06-30/c1-signin-mobile-postfix.png`
- supporting checks:
  - `corepack pnpm -C apps/web test -- --runTestsByPath src/__tests__/lib/authReturnUrl.test.ts src/__tests__/lib/signInRedirectLogic.test.ts` passed, 2 suites / 11 tests
  - `corepack pnpm -C apps/web typecheck` passed
  - `corepack pnpm -C apps/web build` passed
- status: `verified`
- owner: `Codex + User`

### WB-013
- id: `WB-013`
- date: `2026-06-27`
- area: `B2`
- severity: `P1`
- title: Business and booking pages display 0-100 rating scores as impossible star ratings
- build: deployed production `https://kezek.kg` and local workspace with uncommitted A1-A4/B1 fixes based on commit `3dfe9f5c`
- environment: in-app Chromium and Playwright Chromium, Windows, authenticated Google session and clean mobile viewport
- preconditions:
  - public business `low-fade` exists and has rating scores of `50`
- steps:
  1. Open `https://kezek.kg/b/low-fade` directly.
  2. Inspect the business, branch, and staff rating badges.
  3. Open `https://kezek.kg/b/low-fade/booking`.
  4. Inspect the business and branch rating badges in the booking flow.
- expected:
  - Star-style rating badges show a human-readable 0-5 rating, or clearly label the value as a 0-100 score.
- actual:
  - Business, branch, staff, and booking badges show `50.0` next to a star-style rating icon.
  - The shared `RatingDisplay` component is documented as receiving 0-100 scores but renders `value.toFixed(1)` directly.
- evidence:
  - live browser evidence: `apps/web/test-results/live-b2-business-page-2026-06-27/valid-low-fade.json`
  - booking evidence: `apps/web/test-results/live-b2-business-page-2026-06-27/booking-low-fade.json`
  - mobile evidence: `apps/web/test-results/live-b2-business-page-2026-06-27-playwright/b2-playwright.json`
  - screenshots: `apps/web/test-results/live-b2-business-page-2026-06-27/valid-low-fade.png`, `apps/web/test-results/live-b2-business-page-2026-06-27/booking-low-fade.png`
- fix:
  - normalized the shared `RatingDisplay` component to render 0-100 rating scores on a 0-5 public star scale
  - kept already-normalized 0-5 values supported and clamped out-of-range values to the display scale
  - added unit coverage for `formatRatingDisplayValue`
- post-fix verification:
  - targeted test: `src/__tests__/components/RatingDisplay.test.ts`
  - `next build` completed successfully
  - local production live post-fix `/b/low-fade`: `ratings=2.5,2.5,2.5,2.5`, `raw50=false`, `hasImpossibleRating=false`, `console=0`, `fail=0`
  - local production live post-fix `/b/low-fade/booking`: `ratings=2.5,2.5`, `raw50=false`, `hasImpossibleRating=false`, `console=0`, `fail=0`
  - evidence: `apps/web/test-results/live-b2-business-page-2026-06-27-postfix/b2-postfix.json`
  - screenshots: `apps/web/test-results/live-b2-business-page-2026-06-27-postfix/valid-low-fade.png`, `apps/web/test-results/live-b2-business-page-2026-06-27-postfix/booking-low-fade.png`
- status: `verified`
- owner: `Codex + User`

### WB-014
- id: `WB-014`
- date: `2026-06-27`
- area: `B2/D1`
- severity: `P1`
- title: Booking page emits a hydration mismatch when server and browser timezones differ
- build: deployed production `https://kezek.kg`
- environment: in-app Chromium, Windows, Google-authenticated session
- preconditions:
  - user is authenticated in production
  - public business `low-fade` is available
- steps:
  1. Open `https://kezek.kg/b/low-fade/booking`.
  2. Inspect the browser console after the initial hydration.
  3. Select the active branch `Low Fade Юго-Восток` and continue to the date step.
- expected:
  - The booking page hydrates and advances without date text mismatches.
- actual:
  - The console records minified React error `#418` during initial hydration.
  - Reproduction with a local production server forced to `TZ=UTC` confirmed that business midnight was formatted as `26.06.2026` on the server and `27.06.2026` in the browser.
  - The page remained usable, but React had to recover from server/client text differences.
- evidence:
  - live browser evidence: `apps/web/test-results/live-b2-business-page-2026-06-27/booking-after-branch-select.json`
  - screenshot: `apps/web/test-results/live-b2-business-page-2026-06-27/booking-after-branch-select.png`
  - post-fix live evidence: `apps/web/test-results/live-b2-business-page-2026-06-27-wb014-postfix/wb014-postfix.json`
  - post-fix screenshot: `apps/web/test-results/live-b2-business-page-2026-06-27-wb014-postfix/booking-step2-utc-server.png`
- fix:
  - Added timezone-stable conversion between business dates and local calendar dates.
  - Booking day labels now format explicitly in the business timezone.
  - Calendar min/max, selected date, and user selections use stable calendar-day values instead of the runtime timezone.
  - Added regression tests in `src/__tests__/lib/bookingCalendarDate.test.ts`.
- post-fix verification:
  - `next build` passed.
  - Unit tests passed (`5/5` including rating and booking calendar regressions).
  - With the production server forced to `TZ=UTC`, direct load, branch selection, and the date step showed `27.06.2026 (суббота)` consistently.
  - The current-day button was enabled and selected, and no new console warnings or errors appeared.
- status: `verified`
- owner: `Codex + User`

### WB-019
- id: `WB-019`
- date: `2026-06-30`
- area: `B4`
- severity: `P2`
- title: Public map provider failure exposes internal environment configuration details
- build: current local production build with a controlled missing Yandex Maps key
- environment: in-app Chromium, Windows, guest
- preconditions:
  - build and start the web app with the Yandex Maps public key intentionally blank
- steps:
  1. Direct-load `/map`.
  2. Wait for provider initialization to fail.
  3. Inspect the map fallback, branch list, console, and visible error details.
- expected:
  - The user gets a safe provider-unavailable message and can continue through the branch list.
  - Internal variable names, repository paths, and developer setup links are not shown publicly.
- actual:
  - The branch list and all three booking links remain usable.
  - The public fallback displays `NEXT_PUBLIC_YANDEX_MAPS_API_KEY`, `apps/web/.env.local`, and a Yandex developer URL.
- evidence:
  - live record: `apps/web/test-results/live-b4-map-2026-06-30/b4-before-fix.json`
  - screenshot: `apps/web/test-results/live-b4-map-2026-06-30/provider-error-before-fix.png`
- root cause:
  - The provider fallback rendered the raw loader error and had a special case that converted a missing-key error into developer setup instructions.
  - The raw message was also exposed through the paragraph `title` attribute.
- fix:
  - Replaced provider internals with a dedicated public `role="alert"` fallback: `Карта временно недоступна. Выберите филиал из списка.`
  - Kept detailed provider failures only in internal logging.
  - Preserved the independent branch list and booking links while the map canvas is unavailable.
- post-fix live verification:
  - Rebuilt and started the production build with the Yandex Maps key intentionally blank.
  - Direct-loaded `/map` on desktop and `390x844`.
  - Verified the safe fallback, three real branches, and three booking links remain visible and usable.
  - Verified no environment variable name, repository path, developer setup link, horizontal overflow, or stack detail appears.
  - Rebuilt again with the real provider configuration; the final direct load rendered three branch markers and emitted no new console warnings/errors.
  - evidence: `apps/web/test-results/live-b4-map-2026-06-30/b4-live.json`
  - screenshot: `apps/web/test-results/live-b4-map-2026-06-30/provider-error-postfix-mobile.png`
- status: `verified`
- owner: `Codex + User`

### WB-018
- id: `WB-018`
- date: `2026-06-29`
- area: `B3`
- severity: `P1`
- title: Marketplace network failure is shown as a normal empty catalog
- build: current local production build
- environment: in-app Chromium, Windows, controlled unreachable Supabase endpoint on `localhost:3001`
- preconditions:
  - start the production build with a valid-format but unreachable Supabase URL
- steps:
  1. Direct-load `/`.
  2. Wait for the server-rendered marketplace state.
  3. Inspect the result count, empty state, browser console, and visible error messaging.
- expected:
  - A network/data-service failure is explicitly distinguished from a legitimate zero-result catalog.
  - The page remains safe and does not leak connection details or stack traces.
- actual:
  - The business query error is ignored and the page renders `Ничего не найдено` with zero results.
  - The existing safe service-unavailable banner is not shown.
- evidence:
  - live record: `apps/web/test-results/live-b3-search-2026-06-29/b3-before-fix.json`
  - screenshot: `apps/web/test-results/live-b3-search-2026-06-29/network-failure-before-fix.png`
- root cause:
  - Supabase query results were destructured without checking their `error` fields, so transport/query failures were treated as empty arrays.
- fix:
  - Business, branch, and promotion query errors now enter the existing safe failure path.
  - Replaced the ambiguous normal empty state with a dedicated `Каталог временно недоступен` alert for service failures.
- post-fix live verification:
  - Rebuilt and started the production build with a controlled unreachable Supabase endpoint on `localhost:3001`.
  - Direct-loaded `/` on desktop and `390x844`; the dedicated recovery alert rendered, the legitimate empty-catalog message did not, and no stack, host, runtime variable, or secret leaked.
  - No console warnings/errors or horizontal overflow appeared.
  - evidence: `apps/web/test-results/live-b3-search-2026-06-29/b3-postfix.json`
  - screenshot: `apps/web/test-results/live-b3-search-2026-06-29/network-failure-postfix-mobile.png`
- status: `verified`
- owner: `Codex + User`

### WB-017
- id: `WB-017`
- date: `2026-06-29`
- area: `B3`
- severity: `P1`
- title: Marketplace search has no debounced discovery update
- build: current local production build
- environment: in-app Chromium, Windows, real configured Supabase
- preconditions:
  - direct-load `/` with the three approved businesses visible
- steps:
  1. Enter `Man` in the marketplace search input.
  2. Observe the result cards and URL immediately.
  3. Wait `1200 ms` without submitting the form.
- expected:
  - The discovery query updates once after the debounce interval and shows `Manly` without stale cards.
- actual:
  - The input value changes, but the URL and all three result cards remain unchanged after `1200 ms`.
  - Filtering only occurs after clicking `Искать` or submitting the form.
- evidence:
  - live record: `apps/web/test-results/live-b3-search-2026-06-29/b3-before-fix.json`
- root cause:
  - `HomeHeader` used an uncontrolled GET form and had no client-side discovery update or debounce timer.
- fix:
  - Converted the query input to controlled state.
  - Added a `500 ms` debounced `router.replace` that preserves the selected category and resets pagination.
  - Kept explicit form submission as an immediate `router.push` path.
- post-fix live verification:
  - Entering `Man` left the original three cards in place before `300 ms`, then updated the URL to `?q=Man` and rendered only `Manly` after the debounce plus server render.
  - Rapidly entered `L` → `Low` → `Low Fade`; intermediate queries were cancelled and only `Low Fade` remained, with no stale `Manly` card.
  - Category selection preserved the query, clearing the category preserved only the query, and reset restored all three businesses.
  - Empty results persisted across reload; navigation to `Manly` and Back restored `?q=Man`, the input, chip, and single result.
  - Desktop and `390x844` checks showed no console warnings/errors or horizontal overflow.
  - supporting test: `HomeHeader.test.tsx` (`2/2` passed).
  - evidence: `apps/web/test-results/live-b3-search-2026-06-29/b3-postfix.json`
  - screenshot: `apps/web/test-results/live-b3-search-2026-06-29/search-postfix-mobile.png`
- status: `verified`
- owner: `Codex + User`

### WB-016
- id: `WB-016`
- date: `2026-06-27`
- area: `B2`
- severity: `P1`
- title: Public business page omits active services
- build: deployed production `https://kezek.kg` and current local production build before fix
- environment: in-app Chromium, Windows, desktop and mobile viewports
- preconditions:
  - open an approved business that has active bookable services
- steps:
  1. Open `/b/low-fade` directly.
  2. Inspect the business identity, branches, team, promotions, and booking CTA.
  3. Look for the business's active services before entering the booking flow.
- expected:
  - Active services are visible and internally consistent with the booking flow.
  - Inactive services are not presented as bookable.
- actual:
  - The public business page does not query or render services at all.
  - Services only become discoverable later inside the booking flow.
- evidence:
  - live page record: `apps/web/test-results/live-b2-business-page-2026-06-27/valid-low-fade.json`
  - screenshot: `apps/web/test-results/live-b2-business-page-2026-06-27/valid-low-fade.png`
- root cause:
  - `/b/[slug]/page.tsx` fetched businesses, branches, staff, and promotions but omitted the active `services` query.
  - `BusinessInfo.tsx` consequently had no service data or service section to render.
- fix:
  - Added the active-services REST query with `active=eq.true`.
  - Added a localized public service section with branch, duration, and price/range details.
  - Added the active-service count to the business summary.
- post-fix live verification:
  - Direct-loaded the current production build at `/b/b2-contact-live-20260627` using an isolated REST fixture containing one active and one inactive service.
  - Verified `Безопасная тестовая услуга`, its branch, `45 мин`, and `1 200–1 500 сом` render on mobile.
  - Verified `НЕАКТИВНАЯ тестовая услуга` is absent and the observed request contains `active=eq.true`.
  - Verified three booking CTAs remain present, no horizontal overflow occurs, and the console has no warnings or errors.
  - Re-deleted the safe fixture and verified the same slug still renders `Бизнес не найден` without stack/secret leakage.
  - Rebuilt with the real configured Supabase and directly loaded `/b/low-fade`: three real active services rendered with matching branch, duration, and price ranges; no console warnings/errors or mobile overflow appeared.
  - evidence: `apps/web/test-results/live-b2-business-page-2026-06-27-complete/b2-complete.json`
  - screenshot: `apps/web/test-results/live-b2-business-page-2026-06-27-complete/services-postfix-mobile.png`
  - real-Supabase screenshot: `apps/web/test-results/live-b2-business-page-2026-06-27-complete/services-postfix-real-supabase-mobile.png`
- status: `verified`
- owner: `Codex + User`

### WB-015
- id: `WB-015`
- date: `2026-06-27`
- area: `A3` (originally detected during B2)
- severity: `P2`
- title: Deployed business page still sends analytics to the old admin API path
- build: deployed production `https://kezek.kg`
- environment: Playwright Chromium, Windows, 390x844 viewport, guest context
- preconditions:
  - open the deployed production business page in a fresh browser context
- steps:
  1. Open `https://kezek.kg/b/low-fade`.
  2. Wait for network idle.
  3. Inspect failed network responses and console errors.
- expected:
  - Frontend analytics request either succeeds or uses the corrected `/admin/api/analytics/track` path from the current source.
- actual:
  - Browser records `POST https://kezek.kg/api/admin/analytics/track` returning `404`.
  - The visible page remains usable, but telemetry is noisy and not persisted.
- evidence:
  - live browser evidence: `apps/web/test-results/live-b2-business-page-2026-06-27-playwright/b2-playwright.json`
  - screenshot: `apps/web/test-results/live-b2-business-page-2026-06-27-playwright/valid-mobile.png`
- notes:
  - Local source currently sends to `/admin/api/analytics/track`, and `WB-002` verified that fix locally.
  - This finding indicates the deployed production bundle or route behavior is still stale/regressed for the business page surface.
  - A 2026-06-27 release-state probe confirmed the stale path returns `404` and the corrected deployed route exists (the probe reached the route and returned validation status `400` for the intentionally minimal payload).
  - B2 is fully covered on the current local production build; closure of this issue belongs to A3 and requires deployment plus post-deploy live verification.
- status: `open`
- owner: `Codex + User`

### WB-011
- id: `WB-011`
- date: `2026-06-27`
- area: `B1/C5`
- severity: `P1`
- title: WhatsApp sign-in exposes missing server service-role configuration in the public UI
- build: local production build with uncommitted A1-A4/B1 fixes based on commit `3dfe9f5c`
- environment: `http://localhost:3000`, in-app Chromium, Windows, guest, mobile-sized viewport
- preconditions:
  - web application is running from `next build` + `next start`
  - `SUPABASE_SERVICE_ROLE_KEY` is not configured in the runtime environment
- steps:
  1. Open `/auth/sign-in`.
  2. Choose WhatsApp sign-in.
  3. Enter a test phone number.
  4. Submit the form.
- expected:
  - WhatsApp sign-in either starts the OTP flow or fails with a safe, user-friendly service-unavailable message.
  - Public UI does not expose internal runtime variable names or server-side implementation details.
- actual:
  - WhatsApp sign-in shows `SUPABASE_SERVICE_ROLE_KEY is required for server-side operations` in the public error banner.
  - Server log contains `[WhatsAppMobileStart] API error`.
- evidence:
  - screenshot: `apps/web/test-results/live-b1-auth-attempt-2026-06-27/whatsapp-service-role-error.png`
  - server log: `%TEMP%\kezek-b1-auth-2026-06-27\web.stdout.log`
- fix:
  - `POST /api/auth/whatsapp/mobile/start` now detects missing `SUPABASE_SERVICE_ROLE_KEY` before creating the admin Supabase client
  - the route returns `503 service_unavailable` with a safe user-facing message instead of throwing a server configuration error into the public UI
- post-fix verification:
  - targeted test: `src/__tests__/api/auth/whatsapp-mobile-start.test.ts`
  - `next build` completed successfully
  - live post-fix WhatsApp UI shows a safe unavailable message and does not contain `SUPABASE_SERVICE_ROLE_KEY`
  - live console errors: `0`
  - evidence: `apps/web/test-results/live-b1-auth-attempt-2026-06-27-postfix/whatsapp-safe-unavailable.json`
  - screenshot: `apps/web/test-results/live-b1-auth-attempt-2026-06-27-postfix/whatsapp-safe-unavailable.png`
- status: `verified`
- owner: `Codex + User`

### WB-012
- id: `WB-012`
- date: `2026-06-27`
- area: `B1/C3`
- severity: `P1`
- title: Google OAuth callback returns a safe failure screen and does not establish an authenticated session locally
- build: local production build with uncommitted A1-A4/B1 fixes based on commit `3dfe9f5c`
- environment: `http://localhost:3000` / `http://127.0.0.1:3000`, in-app Chromium, Windows, guest
- preconditions:
  - web application is running from `next build` + `next start`
  - tester starts Google sign-in from the local sign-in page
- steps:
  1. Open `/auth/sign-in`.
  2. Choose Google sign-in.
  3. Complete provider-side authentication.
  4. Return to `/auth/callback?code=...`.
  5. Open `/` and inspect the public header.
- expected:
  - OAuth code exchange succeeds and the local browser receives an authenticated session.
  - `/` renders the authenticated public header variant.
- actual:
  - `/auth/callback?code=...` renders `Не удалось завершить авторизацию`.
  - Returning to `/` still shows the guest header with sign-in links, so B1 authenticated header cannot be verified through Google in this environment.
- evidence:
  - screenshot: `apps/web/test-results/live-b1-auth-attempt-2026-06-27/google-callback-error.png`
  - live browser state after attempt: `/` header still contains guest sign-in links and no dashboard/cabinet links
- notes:
  - Google authentication later succeeded on deployed production `https://kezek.kg` and was used to close the B1 authenticated-header check.
  - This bug remains scoped to the local callback/session exchange environment where `/auth/callback?code=...` did not establish a session.
- status: `open`
- owner: `Codex + User`

### WB-009
- id: `WB-009`
- date: `2026-06-27`
- area: `B1`
- severity: `P1`
- title: Public home cards display normalized rating score as an impossible star rating
- build: local production build with uncommitted A1-A4 fixes based on commit `3dfe9f5c`
- environment: `http://localhost:3000`, Chromium/Playwright, Windows, guest, desktop and mobile viewports
- preconditions:
  - web application is running from `next build` + `next start`
  - public marketplace contains approved businesses with `rating_score=50`
- steps:
  1. Open `/` directly in a clean guest browser context.
  2. Inspect visible public marketplace business cards.
  3. Read the rating badge next to the star icon.
- expected:
  - A star-style public rating badge shows a human-readable 0-5 rating, or a clear non-rating score label.
- actual:
  - Cards for `Low Fade`, `Manly`, and `Образ` show `50.0` next to the star icon.
  - The stored `rating_score` is a 0-100 score, so the UI presents an impossible star rating and can mislead users during discovery.
- evidence:
  - live browser evidence: `apps/web/test-results/live-b1-public-home-2026-06-27/b1-live.json`
  - screenshot: `apps/web/test-results/live-b1-public-home-2026-06-27/home-guest.png`
  - runner output: `ratings=Low Fade:50, Manly:50, Образ:50`
- fix:
  - normalized public star-style rating badges to a 0-5 scale while preserving support for already-normalized values
- post-fix verification:
  - `next build` completed successfully
  - targeted tests: `src/__tests__/lib/funnelEventsService.test.ts`, `src/__tests__/lib/funnelEventsHttpService.test.ts`
  - live post-fix runner output: `ratings=Low Fade:2.5, Manly:2.5, Образ:2.5`
  - live browser evidence: `apps/web/test-results/live-b1-public-home-2026-06-27-postfix2/b1-live.json`
  - screenshot: `apps/web/test-results/live-b1-public-home-2026-06-27-postfix2/home-guest.png`
- status: `verified`
- owner: `Codex + User`

### WB-010
- id: `WB-010`
- date: `2026-06-27`
- area: `B1`
- severity: `P2`
- title: Public home booking CTA triggers a 500 funnel-events request
- build: local production build with uncommitted A1-A4 fixes based on commit `3dfe9f5c`
- environment: `http://localhost:3000`, Chromium/Playwright, Windows, guest
- preconditions:
  - web application is running from `next build` + `next start`
  - public marketplace contains at least one approved business card
- steps:
  1. Open `/` directly in a clean guest browser context.
  2. Click the primary booking CTA on the first business card.
  3. Wait for the booking page to render.
  4. Inspect browser console and failed network requests.
- expected:
  - The booking page opens without failed public analytics/funnel requests.
  - Primary CTA telemetry is saved or degrades safely without browser-visible request failures.
- actual:
  - The booking page opens, but `POST /api/funnel-events` returns `500`.
  - Browser console records a failed fetch resource while testing the public home primary CTA.
- evidence:
  - live browser evidence: `apps/web/test-results/live-b1-public-home-2026-06-27/b1-live.json`
  - screenshot: `apps/web/test-results/live-b1-public-home-2026-06-27/card-book-cta.png`
  - server log: `%TEMP%\kezek-b1-live-2026-06-27\web.stdout.log` contains `[FunnelEventsAPI] API error`
- fix:
  - aligned `saveFunnelEvent` insert payload with the actual `funnel_events` table schema by moving `service_ids` and `services_count` into `metadata`
  - made public funnel tracking safely return success with `{ skipped: true }` when `SUPABASE_SERVICE_ROLE_KEY` is not configured, instead of surfacing a browser-visible 500 for non-critical telemetry
- post-fix verification:
  - `next build` completed successfully
  - targeted tests: `src/__tests__/lib/funnelEventsService.test.ts`, `src/__tests__/lib/funnelEventsHttpService.test.ts`
  - live post-fix `card-book-cta`: status `200`, final URL `/b/low-fade/booking?step=1&day=2026-06-27`, `consoleErrors=0`, `pageErrors=0`
  - live browser evidence: `apps/web/test-results/live-b1-public-home-2026-06-27-postfix2/b1-live.json`
  - screenshot: `apps/web/test-results/live-b1-public-home-2026-06-27-postfix2/card-book-cta.png`
- status: `verified`
- owner: `Codex + User`

### WB-001
- id: `WB-001`
- date: `2026-06-23`
- area: `A1`
- severity: `P1`
- title: Hydration mismatch on direct load of `/auth/sign-in`
- build: local dev build, commit `3dfe9f5c`
- environment: Chromium 145, Windows, 1280x720, guest
- preconditions:
  - web application is running locally at `http://localhost:3000`
  - browser has no authenticated Kezek session
- steps:
  1. Open `http://localhost:3000/auth/sign-in` directly in a new browser tab.
  2. Wait for the initial server-rendered page to hydrate.
  3. Inspect the browser console.
- expected:
  - Server-rendered and first client-rendered markup match.
  - The sign-in page hydrates without React replacing the server-rendered tree.
- actual:
  - React reports `Hydration failed because the server rendered HTML didn't match the client`.
  - The mismatch is inside `TelegramLoginWidgetComponent`: the server renders the widget container, while the client renders the localhost Telegram warning.
  - React regenerates the affected tree on the client.
- evidence:
  - console error captured at `2026-06-23T06:12:59.290Z`
  - screenshot: `apps/web/test-results/live-a1-2026-06-23/auth-sign-in.png`
  - final UI remained visible, but the A1 no-hydration-mismatch criterion failed
- fix:
  - resolve the hostname only after mount so the server and initial client render use identical markup
  - do not initialize the Telegram external widget on localhost
- post-fix verification:
  - cold load and direct reload rendered the localhost warning without a hydration error
  - no Telegram widget script was injected on localhost
  - screenshot: `apps/web/test-results/live-a1-postfix-2026-06-23/auth-sign-in-postfix.png`
- status: `verified`
- owner: `Codex + User`

### WB-007
- id: `WB-007`
- date: `2026-06-27`
- area: `A4`
- severity: `P2`
- title: Unknown routes use the default Next.js 404 instead of an understandable Kezek recovery UI
- build: local production build (`next build` + `next start`) with uncommitted A1/A2/A3 fixes based on commit `3dfe9f5c`
- environment: `http://localhost:3000`, in-app browser smoke plus Chromium via Playwright, Windows, guest, clean browser context, 1280x720
- preconditions:
  - run `apps/web` from production output via `next start`
  - use a guest browser session
- steps:
  1. Open `http://localhost:3000/__a4_unknown_public__`.
  2. Open unknown scoped routes: `/cabinet/__a4_unknown__`, `/dashboard/__a4_unknown__`, `/staff/__a4_unknown__`, and `/admin/__a4_unknown__`.
  3. Inspect visible text, recovery actions, console, network, and leak indicators.
- expected:
  - Unknown routes show an understandable Kezek-branded not-found state.
  - The page includes explicit recovery actions, such as going home or signing in.
  - No stack traces, local paths, tokens, cookies, or secrets are exposed.
- actual:
  - All tested unknown routes render the default Next.js text `404 / This page could not be found.`
  - There is no explicit visible “home” recovery action; the only home navigation is the header logo link with empty accessible text in the captured DOM.
  - No stack traces, local paths, tokens, cookies, or secrets were observed.
- evidence:
  - screenshots: `apps/web/test-results/live-a4-error-boundaries-2026-06-27/unknown-public.png`, `unknown-cabinet.png`, `unknown-dashboard.png`, `unknown-staff.png`, `unknown-admin.png`
  - browser evidence: `apps/web/test-results/live-a4-error-boundaries-2026-06-27/a4-live.json`
  - production server logs: `%TEMP%\kezek-a4-live-2026-06-27\web.stdout.log`, `%TEMP%\kezek-a4-live-2026-06-27\web.stderr.log`
- fix:
  - added a root `app/not-found.tsx` with Kezek-branded copy and explicit `На главную` and `Войти` recovery actions
- post-fix verification:
  - rebuilt `apps/web` with `next build`
  - restarted the production server via `next start`
  - re-opened unknown public, cabinet, dashboard, staff, and admin routes in a clean Chromium context
  - all unknown routes rendered `Страница не найдена`, no default Next.js 404 text, no production error boundary, and no stack/secret leak indicators
  - screenshots: `apps/web/test-results/live-a4-error-boundaries-2026-06-27-postfix/unknown-public.png`, `unknown-cabinet.png`, `unknown-dashboard.png`, `unknown-staff.png`, `unknown-admin.png`
  - browser evidence: `apps/web/test-results/live-a4-error-boundaries-2026-06-27-postfix/a4-live.json`
  - production server logs: `%TEMP%\kezek-a4-live-2026-06-27-postfix\web.stdout.log`, `%TEMP%\kezek-a4-live-2026-06-27-postfix\web.stderr.log`
- status: `verified`
- owner: `Codex + User`

### WB-008
- id: `WB-008`
- date: `2026-06-27`
- area: `A4`
- severity: `P2`
- title: `/map` hides a failed branches request as an empty state and offers no retry action
- build: local production build (`next build` + `next start`) with uncommitted A1/A2/A3 fixes based on commit `3dfe9f5c`
- environment: `http://localhost:3000`, Chromium via Playwright, Windows, guest, clean browser context, 1280x720
- preconditions:
  - run `apps/web` from production output via `next start`
  - intercept `GET /api/branches/map` in the browser and return a controlled `500` JSON response
- steps:
  1. Open `http://localhost:3000/map`.
  2. Force `GET /api/branches/map` to return `500`.
  3. Inspect the visible UI, console, network, and available retry/home actions.
- expected:
  - A client request failure is surfaced as an understandable error state.
  - The user gets a retry action or another clear recovery path.
  - The failed request is not silently represented as “no data”.
- actual:
  - The page stays usable and the map renders.
  - The branch list shows only `no data`, which is indistinguishable from a real empty catalog.
  - No retry action is present for the failed branches request.
  - The console logs the controlled `500` resource failure and `[MapPage] Fetch map failed`.
- evidence:
  - screenshot: `apps/web/test-results/live-a4-error-boundaries-2026-06-27/client-map-controlled-failure.png`
  - browser evidence: `apps/web/test-results/live-a4-error-boundaries-2026-06-27/a4-live.json`
  - production server logs: `%TEMP%\kezek-a4-live-2026-06-27\web.stdout.log`, `%TEMP%\kezek-a4-live-2026-06-27\web.stderr.log`
- fix:
  - added a dedicated `/map` branches-load failure state instead of replacing failures with the empty-list state
  - added a `Попробовать снова` retry action that re-runs the branches map request
  - kept the existing non-destructive map view usable while the list request is in an error state
- post-fix verification:
  - rebuilt `apps/web` with `next build`
  - restarted the production server via `next start`
  - opened `/map` with a controlled first `GET /api/branches/map` response of `500`
  - verified the page displayed `Не удалось загрузить филиалы. Попробуйте обновить список.` and a `Попробовать снова` button instead of `no data`
  - clicked `Попробовать снова`; the second request was allowed to reach the real API and the page remained usable
  - screenshot: `apps/web/test-results/live-a4-error-boundaries-2026-06-27-postfix/client-map-controlled-failure.png`
  - browser evidence: `apps/web/test-results/live-a4-error-boundaries-2026-06-27-postfix/a4-live.json`
  - production server logs: `%TEMP%\kezek-a4-live-2026-06-27-postfix\web.stdout.log`, `%TEMP%\kezek-a4-live-2026-06-27-postfix\web.stderr.log`
- status: `verified`
- owner: `Codex + User`

### WB-006
- id: `WB-006`
- date: `2026-06-27`
- area: `A3`
- severity: `P2`
- title: Production CSP blocks Yandex Maps logging requests on `/map`
- build: local production build (`next build` + `next start`) with production-like public origin settings and uncommitted A1/A2 fixes based on commit `3dfe9f5c`
- environment: `http://localhost:3000`, Chromium via Playwright, Windows, guest, clean browser context, 1280x720
- preconditions:
  - run `apps/web` from production output via `next start`
  - open the browser with a clean profile and no authenticated Kezek session
- steps:
  1. Open `http://localhost:3000/map`.
  2. Wait until the page and map assets settle.
  3. Reload the page directly.
  4. Inspect the browser console and network/resource results.
- expected:
  - Production pages do not emit CSP console errors during normal third-party map initialization.
  - Static assets, chunks, fonts, images, and expected provider resources load without production-only failures.
- actual:
  - `/map` visually renders and all captured static assets return successfully.
  - The browser console reports that `connect-src` blocks Yandex Maps logging calls to `https://log.api-maps.yandex.ru/...`.
  - The blocked request is non-destructive and does not break the visible map, but it is a production CSP integration error.
- evidence:
  - screenshot: `apps/web/test-results/live-a3-prod-smoke-2026-06-27/map.png`
  - browser evidence: `apps/web/test-results/live-a3-prod-smoke-2026-06-27/prod-smoke.json`
  - production server logs: `%TEMP%\kezek-a3-prod-smoke-2026-06-27\web.stdout.log`, `%TEMP%\kezek-a3-prod-smoke-2026-06-27\web.stderr.log`
- fix:
  - added `https://log.api-maps.yandex.ru` to the production CSP `connect-src` allowlist
  - kept the allowlist scoped to the Yandex Maps logging host instead of broadening all Yandex domains
- post-fix verification:
  - rebuilt `apps/web` with `next build`
  - restarted the production server via `next start`
  - re-ran the A3 live smoke in a clean Chromium context
  - `/map` rendered with `consoleErrors=0`, `failingAssets=0`, `failingResponses=0`, `requestFailures=0`, and no page errors
  - screenshot: `apps/web/test-results/live-a3-prod-smoke-2026-06-27-postfix/map.png`
  - browser evidence: `apps/web/test-results/live-a3-prod-smoke-2026-06-27-postfix/prod-smoke.json`
  - production server logs: `%TEMP%\kezek-a3-prod-smoke-2026-06-27-postfix\web.stdout.log`, `%TEMP%\kezek-a3-prod-smoke-2026-06-27-postfix\web.stderr.log`
- status: `verified`
- owner: `Codex + User`

### WB-002
- id: `WB-002`
- date: `2026-06-23`
- area: `A1`
- severity: `P2`
- title: Public entry pages send failing frontend analytics requests
- build: local dev build, commit `3dfe9f5c`
- environment: Chromium 145, Windows, 1280x720, guest
- preconditions:
  - web application is running locally at `http://localhost:3000`
- steps:
  1. Open `/`, `/auth/sign-in`, `/terms`, or `/privacy` directly.
  2. Wait for the page to finish loading.
  3. Inspect the application server request log.
- expected:
  - Frontend metrics and analytics requests either succeed or are disabled cleanly in the local environment.
- actual:
  - `POST /api/metrics/frontend` repeatedly returns `500`.
  - Repeated public navigation eventually rate-limits the same endpoint with `429`.
  - The home-page analytics request `POST /api/admin/analytics/track` returns `404`.
  - Page content remains usable, but telemetry is not recorded successfully and generates noisy failures.
- evidence:
  - server request log in `%TEMP%\kezek-a1-live\web.stdout.log`
  - examples: `POST /api/metrics/frontend 500`, `POST /api/admin/analytics/track 404`
  - screenshots: `apps/web/test-results/live-a1-2026-06-23/`
- fix:
  - corrected the analytics route from `/api/admin/analytics/track` to `/admin/api/analytics/track`
  - disabled analytics and performance-metric delivery on localhost, where service-role persistence is intentionally unavailable
- post-fix verification:
  - repeated direct loads, reloads, and history navigation produced no requests to either failing telemetry URL
  - `%TEMP%\kezek-a1-postfix\web.stdout.log` contains no frontend metrics or analytics failures
- status: `verified`
- owner: `Codex + User`

### WB-003
- id: `WB-003`
- date: `2026-06-23`
- area: `A1`
- severity: `P2`
- title: Legal pages overflow horizontally on a mobile viewport
- build: local dev build, commit `3dfe9f5c`
- environment: Chromium 145, Windows, 390x844 viewport, guest
- preconditions:
  - web application is running locally at `http://localhost:3000`
- steps:
  1. Set the browser viewport to 390x844.
  2. Open `/terms` or `/privacy` directly.
  3. Compare `document.documentElement.scrollWidth` with `clientWidth`.
- expected:
  - Legal content fits the viewport without horizontal page scrolling.
- actual:
  - `/terms`: `scrollWidth=392`, `clientWidth=375`.
  - `/privacy`: `scrollWidth=447`, `clientWidth=375`.
  - `/` and `/auth/sign-in` do not exhibit horizontal overflow at the same viewport.
- evidence:
  - live browser DOM measurements at 390x844
  - the unbroken H1 text expands its scroll width beyond the available content width
  - screenshots: `apps/web/test-results/live-a1-2026-06-23/terms-mobile-390.png` and `privacy-mobile-390.png`
- fix:
  - reduced legal-card padding on mobile
  - added safe wrapping and responsive sizing to long legal headings
  - added minimum-width constraints to the legal content containers
- post-fix verification:
  - `/terms`: `scrollWidth=375`, `clientWidth=375`
  - `/privacy`: `scrollWidth=390`, `clientWidth=390`
  - screenshots: `apps/web/test-results/live-a1-postfix-2026-06-23/terms-mobile-postfix.png` and `privacy-mobile-postfix.png`
- status: `verified`
- owner: `Codex + User`

### WB-004
- id: `WB-004`
- date: `2026-06-23`
- area: `A2`
- severity: `P1`
- title: Invalid auth callback routes can hang on an authorization spinner instead of failing explicitly
- build: local dev build with uncommitted A1 fixes based on commit `3dfe9f5c`
- environment: `http://localhost:3000`, in-app Chromium, Windows, guest, 1280x720
- preconditions:
  - web application is running locally with the normal `.env.local`
  - browser has no authenticated Kezek session
- steps:
  1. Open `http://localhost:3000/auth/callback?code=invalid-a2-code` directly.
  2. Wait 8 seconds.
  3. Open `http://localhost:3000/auth/callback-yandex?code=invalid-a2-code&state=a2` directly.
  4. Wait 8 seconds.
  5. Inspect the browser UI, console, and application request log.
- expected:
  - Invalid, expired, or malformed callback input fails explicitly and safely.
  - The user is returned to a sign-in/retry state or sees a clear non-sensitive error.
  - Server/API failures do not leave the browser on an indefinite authorization state.
- actual:
  - `/auth/callback?code=invalid-a2-code` remains on `Авторизация…` after 8 seconds.
  - `/auth/callback-yandex?code=invalid-a2-code&state=a2` remains on `Авторизация через Яндекс…` after 8 seconds.
  - The Yandex callback page triggers `GET /api/auth/yandex/callback?...` which returns `500`, while the UI still stays on the spinner.
  - No clear recovery action or safe error message is shown in the browser.
- evidence:
  - screenshots: `apps/web/test-results/live-a2-2026-06-23/auth-callback-invalid-long.png`, `apps/web/test-results/live-a2-2026-06-23/yandex-callback-invalid-long.png`
  - browser evidence: `apps/web/test-results/live-a2-2026-06-23/callback-invalid-long.json`
  - request log: `%TEMP%\kezek-a2-live\web.stdout.log`
- fix:
  - invalid Supabase OAuth callback codes now switch the callback page to an explicit authorization failure state instead of continuing to poll or redirect as success
  - the failure state includes a safe recovery link back to sign-in
  - Yandex token/profile exchange failures now return a redirect to `/auth/sign-in?error=yandex_exchange_failed` instead of surfacing as API `500`
- post-fix verification:
  - `/auth/callback?code=invalid-a2-code` rendered `Не удалось завершить авторизацию` with `Вернуться ко входу` and no authorization spinner
  - `/auth/callback-yandex?code=invalid-a2-code&state=a2` redirected to `/auth/sign-in?error=yandex_exchange_failed`
  - `GET /api/auth/yandex/callback?code=invalid-a2-code&redirect=%2F` returned `307` to the sign-in error URL instead of `500`
  - screenshots: `apps/web/test-results/live-a2-postfix-2026-06-23/valid-auth-callback-invalid-final.png`, `apps/web/test-results/live-a2-postfix-2026-06-23/valid-yandex-callback-invalid-final.png`
  - browser evidence: `apps/web/test-results/live-a2-postfix-2026-06-23/valid-final.json`
  - request log: `%TEMP%\kezek-a2-postfix-final-valid\web.stdout.log`
- status: `verified`
- owner: `Codex + User`

### WB-005
- id: `WB-005`
- date: `2026-06-23`
- area: `A2`
- severity: `P1`
- title: Invalid Supabase runtime configuration is not surfaced consistently as an explicit safe failure
- build: local dev build with uncommitted A1 fixes based on commit `3dfe9f5c`
- environment: controlled invalid-env local run at `http://localhost:3000`, in-app Chromium, Windows, guest, 1280x720
- preconditions:
  - start the web app with `NEXT_PUBLIC_SUPABASE_URL` set to a non-URL value
  - use dummy Supabase keys and a non-URL `NEXT_PUBLIC_SITE_ORIGIN`
  - do not modify `.env.local`
- steps:
  1. Open `http://localhost:3000/`.
  2. Inspect the visible UI and browser console.
  3. Open `http://localhost:3000/auth/sign-in`.
  4. Inspect the visible UI and browser console.
- expected:
  - Missing or invalid runtime configuration fails explicitly and safely.
  - Public entry routes show a clear non-sensitive configuration error or the app fails startup before serving a blank shell.
  - Stack traces and local build paths are not part of user-facing production-style failure surfaces.
- actual:
  - `/` renders a blank page body while the browser console contains Server Component and middleware errors for the invalid Supabase URL.
  - `/auth/sign-in` renders the app error boundary with `Что-то пошло не так`, but also includes development stack details and local `.next`/filesystem paths.
  - The failure is explicit in some places but not consistently safe or user-visible across public entry routes.
- evidence:
  - screenshots: `apps/web/test-results/live-a2-2026-06-23/invalid-env-home.png`, `apps/web/test-results/live-a2-2026-06-23/invalid-env-sign-in.png`
  - browser evidence: `apps/web/test-results/live-a2-2026-06-23/invalid-env-browser.json`
  - request log: `%TEMP%\kezek-a2-invalid-env-2\web.stderr.log`
- fix:
  - guarded `AuthStatusServer` and middleware against invalid Supabase runtime configuration
  - made the browser Supabase client use an inert HTTPS placeholder when public config is invalid so public pages can render instead of throwing during module import
  - made the home page fall back to a safe empty/catalog-unavailable state when marketplace data cannot be loaded
  - removed development stack details from the default app error boundary UI
- post-fix verification:
  - controlled invalid-env `/` rendered the public home page with `Сервис временно недоступен`, `Найдите свой сервис`, no blank body, and no visible stack details
  - controlled invalid-env `/auth/sign-in` rendered the sign-in page with `Сервис временно недоступен`, no error boundary, and no visible stack details
  - screenshots: `apps/web/test-results/live-a2-postfix-2026-06-23/invalid-env-home-final.png`, `apps/web/test-results/live-a2-postfix-2026-06-23/invalid-env-sign-in-final.png`
  - browser evidence: `apps/web/test-results/live-a2-postfix-2026-06-23/invalid-env-final.json`
  - request/error log: `%TEMP%\kezek-a2-postfix-invalid-env\web.stderr.log`
- status: `verified`
- owner: `Codex + User`

### WB-035
- id: `WB-035`
- date: `2026-07-05`
- area: `C4`
- severity: `P0`
- title: WhatsApp linking OTP is accepted by the UI but may not be delivered outside the 24-hour messaging window
- environment: `https://kezek.kg/cabinet/profile`, production, authenticated user
- steps:
  1. Open the profile and start connecting a WhatsApp number.
  2. Request the confirmation code.
  3. Observe that the UI opens the OTP field, but no WhatsApp message arrives.
- expected:
  - The OTP is sent through the approved WhatsApp authentication/utility template and is delivered outside the customer-service window.
- actual:
  - Profile linking used a free-form text message while the sign-in flow used the configured OTP template. Meta can accept the API request and later reject delivery outside the 24-hour window.
- evidence:
  - user screenshot `codex-clipboard-499ded74-4c32-4f3b-98f9-a45b3cd22927.png`
  - source comparison: `whatsAppSendOtpRouteService.ts` did not pass template configuration used by `whatsAppAuthSendOtpRouteService.ts`
- fix:
  - profile WhatsApp OTP now uses the configured template name, language, and OTP body component, matching the sign-in flow
  - if the production OTP template is missing, the API now fails explicitly instead of claiming that an undeliverable code was sent
- post-fix verification:
  - automated service test verifies the template payload; production delivery requires deployment and a fresh live request
- status: `fixed, awaiting production live verification`
- owner: `Codex + User`

### WB-036
- id: `WB-036`
- date: `2026-07-05`
- area: `C4`
- severity: `P1`
- title: Profile action errors are rendered below all settings and can be missed
- environment: `https://kezek.kg/cabinet/profile`, production, authenticated user, desktop
- steps:
  1. Scroll to the connected login methods or notification settings.
  2. Trigger a provider-linking error.
  3. Observe the error placement near the bottom action bar.
- expected:
  - Action feedback remains immediately visible wherever the user is positioned in the long profile form.
- actual:
  - The error banner is rendered after all profile sections and is easy to miss.
- evidence:
  - user screenshot `codex-clipboard-665832ac-1f25-4756-a713-3f00bbff1609.png`
- fix:
  - error and success feedback moved to a sticky alert region at the top of the form, above the content and below the fixed header
  - alerts now have stronger elevation, an explicit error title, and a close action
- post-fix verification:
  - pending local and production live verification
- status: `fixed, awaiting live verification`
- owner: `Codex + User`

### WB-037
- id: `WB-037`
- date: `2026-07-05`
- area: `C4`
- severity: `P0`
- title: A WhatsApp number owned by an existing Auth account can be linked to a second Kezek profile
- environment: `https://kezek.kg/cabinet/profile`, production, authenticated user
- steps:
  1. Use a WhatsApp number that already has a separate Kezek Auth account.
  2. Sign in to another Kezek account through a different provider.
  3. Connect and verify the existing WhatsApp number in profile settings.
- expected:
  - Linking is rejected because one external WhatsApp identity must have exactly one Kezek owner.
- actual:
  - Linking succeeds when the old account owns the phone in Supabase Auth but has no corresponding verified `profiles.whatsapp_phone` value.
  - A later WhatsApp login can still resolve to the old Auth user instead of the account where the number was newly linked.
- evidence:
  - user production report after successful WhatsApp linking
  - source audit: profile OTP verification checked only the partial unique index on `profiles.whatsapp_phone`; WhatsApp login checks Supabase Auth users first
- fix:
  - before profile linking, the verified phone is now checked against Supabase Auth ownership
  - linking returns `409 whatsapp_identity_already_linked` when another Auth user owns the phone
  - Auth lookup failures fail closed without changing profile ownership
- post-fix verification:
  - automated conflict test added; production live verification requires deployment
- status: `fixed, awaiting production live verification`
- owner: `Codex + User`

### WB-038
- id: `WB-038`
- date: `2026-07-05`
- area: `C4`
- severity: `P1`
- title: Connected social login methods cannot be unlinked from the profile
- environment: web profile, authenticated user
- steps:
  1. Connect more than one login method.
  2. Open the profile connection settings.
  3. Try to remove an obsolete or incorrectly linked provider.
- expected:
  - Any provider can be unlinked while at least one other verified login method remains.
  - Removing Telegram or WhatsApp also disables its notification channel.
- actual:
  - Connected providers only display a status badge; no unlink action exists.
- fix:
  - added unlink actions for Google, Yandex, Telegram, and WhatsApp
  - server re-evaluates all connection sources and rejects removal of the final login method
  - Google identity removal is restricted to a service-role-only database function
  - Telegram and WhatsApp notification preferences are disabled when their identity is removed
- post-fix verification:
  - service tests cover last-method rejection, Google unlinking, and WhatsApp cleanup; live verification pending deployment
- status: `fixed, awaiting live verification`
- owner: `Codex + User`

### WB-039
- id: `WB-039`
- date: `2026-07-06`
- area: `C4`
- severity: `P1`
- title: Legacy Yandex connection is visible in profile but unlink API reports that it is not connected
- environment: `https://kezek.kg/cabinet/profile`, production, authenticated user
- steps:
  1. Open a profile whose Yandex identity is stored in Auth metadata but not in `profiles.yandex_id`.
  2. Observe the connected Yandex badge.
  3. Click `Отвязать` and confirm.
- expected:
  - The server recognizes the same connection sources as the UI and removes the Yandex link.
- actual:
  - UI reports `Подключено`, while the API returns `Яндекс уже не подключён`.
- evidence:
  - user screenshot `codex-clipboard-d44a87b4-3aa3-4d7d-89d3-bc382478fddf.png`
  - source audit confirmed UI fallback to Auth metadata was absent from unlink service
- fix:
  - unlink service now recognizes Yandex and Telegram legacy Auth metadata, matching profile UI detection
  - regression test covers Yandex stored only in Auth metadata
- post-fix verification:
  - automated test pending execution; production live verification requires deployment
- status: `fixed, awaiting production live verification`
- owner: `Codex + User`

### WB-040
- id: `WB-040`
- date: `2026-07-06`
- area: `C4`
- severity: `P1`
- title: Successful Yandex unlink leaves merged Auth metadata and the UI still shows connected
- environment: `https://kezek.kg/cabinet/profile`, production, authenticated user
- steps:
  1. Unlink a legacy Yandex connection.
  2. Observe the success message.
  3. Inspect the Yandex connection row after profile reload.
- expected:
  - Yandex is shown as disconnected immediately after successful unlink.
- actual:
  - Success is shown, but Yandex remains connected because Auth metadata fields survive a merge update.
- evidence:
  - user screenshot `codex-clipboard-36ca5464-e009-49ae-99a0-81aa8a6a16ff.png`
  - Supabase admin user metadata updates merge keys; omitting a key does not remove the stored value
- fix:
  - provider metadata fields are now explicitly assigned `null` during unlink instead of being omitted
  - the same correction is applied to Yandex, Telegram, and WhatsApp metadata cleanup
- post-fix verification:
  - automated assertion updated; production live verification requires deployment
- status: `fixed, awaiting production live verification`
- owner: `Codex + User`

### WB-041
- id: `WB-041`
- date: `2026-07-06`
- area: `C4 / mobile WhatsApp auth`
- severity: `P0`
- title: WhatsApp identity created through a legacy/mobile profile path can still be linked to another account
- environment: production, separate client and owner accounts
- steps:
  1. Create or use a client account entered through WhatsApp.
  2. Sign in to a different owner account.
  3. Add the same WhatsApp number as a second login method.
- expected:
  - Linking is rejected because the number already owns another Kezek account.
- actual:
  - Linking succeeds when ownership is stored in legacy `profiles.phone`, Auth metadata, or a differently formatted Auth phone.
- evidence:
  - user production report on 2026-07-06
  - source audit: mobile verify wrote verified identity to `profiles.phone`; ownership lookup compared only exact `auth.users.phone`
- fix:
  - ownership lookup now normalizes and checks Auth phone, Auth metadata phone, modern `whatsapp_phone`, and legacy verified profile phone
  - mobile WhatsApp verification now writes `whatsapp_phone`
  - safe backfill migration added for non-conflicting legacy mobile identities
- post-fix verification:
  - focused ownership and mobile integration tests pending; production live verification requires deployment
- status: `fixed, awaiting production live verification`
- owner: `Codex + User`

### WB-042
- id: `WB-042`
- date: `2026-07-06`
- area: `C5 / account lifecycle`
- severity: `P1`
- title: Users have no self-service account deletion lifecycle
- environment: web profile, authenticated users of all roles
- steps:
  1. Open profile settings.
  2. Look for account deletion controls.
- expected:
  - Eligible users can request deletion, cancel during a grace period, and receive role-specific remediation when deletion is blocked.
- actual:
  - The public policy describes deletion, but no functional self-service control or scheduled finalization exists.
- fix:
  - added seven-day deletion requests with cancellation
  - blocks super-admins, business owners, active staff, business-role holders, and clients with future active bookings
  - disables notifications when deletion is requested
  - daily retention cron finalizes eligible requests, deletes reviews and Auth identity, and anonymizes retained booking history
  - added profile danger-zone UI with explicit `УДАЛИТЬ` confirmation and actionable blockers
- post-fix verification:
  - automated service/type/lint checks pending; migration and production live verification required
- status: `fixed, awaiting live verification`
- owner: `Codex + User`

### WB-043
- id: `WB-043`
- date: `2026-07-07`
- area: `E / business and branch administration`
- severity: `P1`
- title: Business owners can create an unlimited number of branches
- environment: owner dashboard and super-admin business management
- steps:
  1. Open branch management for a business.
  2. Repeatedly create branches.
- expected:
  - Every business has an explicit branch allowance controlled by super-admin.
  - Existing businesses are limited to their current branch count, or one branch when they currently have none.
- actual:
  - No business-level limit exists and owners can create branches indefinitely.
- fix:
  - added mandatory `businesses.branch_limit`
  - existing businesses are backfilled to `max(current branch count, 1)`
  - new business creation requires super-admin to specify a limit from 1 to 1000
  - database trigger atomically rejects inserts over the limit across all API paths
  - owner and admin branch screens display usage and hide creation actions at the limit
- post-fix verification:
  - focused service test added; migration and live verification pending
- status: `fixed, awaiting live verification`
- owner: `Codex + User`

### WB-044
- id: `WB-044`
- date: `2026-07-07`
- area: `B / business onboarding`
- severity: `P1`
- title: Guests and non-owner users cannot submit a business registration application
- environment: public web and authenticated sessions of any role
- steps:
  1. Visit the public site as a guest or non-owner user.
  2. Try to request registration of a business.
- expected:
  - Anyone can submit contact and business details without changing their current role or creating an account first.
- actual:
  - Business creation is available only inside super-admin tooling and no public application flow exists.
- fix:
  - added public `/business/apply` form for guests and every authenticated role
  - authenticated applications retain optional user ownership context
  - added validation, phone normalization, honeypot, hourly rate limiting, and 24-hour duplicate suppression
  - added super-admin application queue with contacted/approved/rejected statuses
- post-fix verification:
  - focused service tests added; migration and live verification pending
- status: `fixed, awaiting live verification`
- owner: `Codex + User`

### WB-045
- id: `WB-045`
- date: `2026-07-16`
- area: `B / business onboarding and public business links`
- severity: `P1`
- title: Registration directory links are not copied to the first created branch
- environment: production `https://kezek.kg`
- steps:
  1. Submit a business registration application with Instagram, 2GIS, Google Maps, and Yandex Maps links.
  2. Approve the application in `/admin/business-applications` and create the first branch for the created business without entering links manually.
  3. Open the created branch edit page in admin.
- expected:
  - The four submitted directory links are copied to the first branch of the newly created business and are available for public display.
- actual:
  - The application queue displayed all four submitted links, but all four directory-link fields were empty on the first branch edit page after creation.
- evidence:
  - Production application: `LIVE LINKS Business 11412753`; queue showed all four submitted links.
  - Production created business: `458193de-4cc5-4654-871e-760f1b73b825`; first branch `LIVE LINKS First Branch`; branch usage showed `1 из 1`.
  - Production branch edit page: all Instagram, 2GIS, Google Maps, and Yandex Maps inputs had no value.
- fix:
  - centralized first-branch link resolution in `branchCreateService` for owner and admin creation paths;
  - explicit branch links always win, while empty first-branch input loads links from the linked registration application;
  - database trigger remains as a defensive fallback for direct inserts;
  - branch edit form now treats link changes as unsaved changes.
- verification:
  - targeted `branchCreateService` tests: 5 passed;
  - TypeScript check passed;
  - production build passed;
  - production post-fix application form and admin queue are live after commit `b0b64646`;
  - live post-fix verification on `2026-07-17` approved synthetic application `POSTFIX LINKS 12398389`, created business `72dcfe62-4a72-46d5-945f-1677671596ac`, created first branch `POSTFIX First Branch`, and confirmed all four links on the branch edit page and public page `/b/postfix-links-12398389`.
- status: `verified`
- owner: `Codex + User`

### WB-048
- id: `WB-048`
- date: `2026-07-16`
- area: `B2 / public business page`
- severity: `P1`
- title: Public business page emits a React hydration error in production
- environment: production `https://kezek.kg/b/live-links-business-11412753`
- steps:
  1. Open the valid business slug directly in a fresh production tab.
  2. Inspect browser console after the page finishes loading.
- expected:
  - The public business page hydrates without React errors.
- actual:
  - Browser console emitted minified React error `#418` from the production Next.js chunk while the page was loading.
- evidence:
  - Production browser console at `2026-07-16T14:21:24.802Z`: `Minified React error #418` from `/_next/static/chunks/51c21aac98c1a553.js`.
  - The page remained visible and showed the created business and first branch, but the hydration error indicates server/client markup divergence.
- status: `open`
- owner: `Codex + User`

### WB-050
- id: `WB-050`
- date: `2026-07-16`
- area: `B / business onboarding and owner assignment`
- severity: `P1`
- title: Approving a business application fails with an unhandled duplicate-owner database error
- environment: production `https://kezek.kg/admin/business-applications`
- steps:
  1. Submit an authenticated business registration application from a user who already owns a business.
  2. Open the application in the super-admin queue.
  3. Click `Одобрить и создать бизнес`.
- expected:
  - The system either applies the documented ownership policy or presents a clear actionable explanation and a safe alternative for the administrator.
- actual:
  - Business creation fails with raw database text `duplicate key value violates unique constraint "businesses_one_owner_per_user"` in the application card; no business or first branch is created.
- evidence:
  - Production synthetic application `POSTFIX LINKS 12398389` reached the admin queue with all four directory links visible.
  - Approval at `2026-07-16` failed before branch creation with the duplicate-owner constraint error.
- fix:
  - applied migration `20260717010000_drop_global_owner_business_index.sql` in production on `2026-07-17` to remove the incorrect global owner uniqueness index;
  - kept ownership uniqueness scoped to the business membership relation, so one user can own multiple businesses without duplicate roles inside one business.
- post-fix verification:
  - production approval succeeded for synthetic application `POSTFIX LINKS 12398389`;
  - created business `72dcfe62-4a72-46d5-945f-1677671596ac` for the same owner who already owned another business;
  - the new business page showed status `Одобрен`, the same owner, and branch limit `1`;
  - first branch creation succeeded and the public page loaded with the expected business and branch;
  - unrelated console issues remain tracked separately as `WB-048` (React hydration) and `WB-049` (missing Yandex Maps key).
- status: `verified`
- owner: `Codex + User`

### WB-049
- id: `WB-049`
- date: `2026-07-16`
- area: `A2 / environment and service wiring; branch management`
- severity: `P1`
- title: Production branch map cannot initialize because the Yandex Maps API key is missing
- environment: production `https://kezek.kg/admin/businesses/458193de-4cc5-4654-871e-760f1b73b825/branches/556d4e57-853c-4fc5-b32a-b53ab5ac65b6`
- steps:
  1. Open the branch edit page in production.
  2. Inspect the map area and browser console.
- expected:
  - The map initializes and allows the administrator to select or adjust branch coordinates.
- actual:
  - The UI shows `Ошибка загрузки карты` and falls back to manual address entry; console reports `[BranchMapPicker] Failed to initialize Yandex Maps`.
- evidence:
  - Production DOM displayed `Карта временно недоступна. Введите адрес филиала вручную.`
  - Production console reported the map initialization error from `/_next/static/chunks/84daa0763d770a94.js`.
- status: `open`
- owner: `Codex + User`

### WB-051
- id: `WB-051`
- date: `2026-07-17`
- area: `dashboard / multi-business owner workspace`
- severity: `P1`
- title: Owner workspace has no business selector after enabling multiple businesses
- environment: production `https://kezek.kg`
- steps:
  1. Authenticate as an owner who owns an existing business and the newly approved second business.
  2. Open `/dashboard` directly.
  3. Open `/select-cabinet` and inspect the available cabinet choices.
  4. Try the header role control and reload the dashboard.
- expected:
  - The owner can see all businesses they own and has a clear business selector or switcher.
  - Selecting another business changes the workspace context and remains correct after reload.
- actual:
  - `/dashboard` showed only the first business (`LIVE AUTH Business 2026071618045`, id `481ec1e2-287c-435a-9f98-d5b003dec4a7`).
  - The second business (`POSTFIX LINKS 12398389`, id `72dcfe62-4a72-46d5-945f-1677671596ac`) was not available in the owner workspace.
  - `/select-cabinet` only offered `Кабинет бизнеса` vs `Мои записи`, not a business-to-business selector; the header role control did not expose a switcher.
- evidence:
  - Live production owner session on `2026-07-17` loaded `/dashboard` successfully but exposed only one business context.
  - Post-deploy live check of commit `e0c45859` confirmed the new business-switcher client is active, but `/api/me/current-business` resolves only `LIVE AUTH Business 2026071618045` for the current WhatsApp session; `/select-business` therefore redirects back to `/dashboard` as a single-business account.
  - The known second business `POSTFIX LINKS 12398389` is not returned for this authenticated user, so the UI intentionally hides the multi-business choices (`businesses.length > 1`).
  - Browser console contained no new errors or warnings during the check.
  - Reproduction completed through the approval boundary on `2026-07-17`: the authenticated WhatsApp owner submitted `LIVE MULTI OWNER TEST 20260717-1945`; super-admin approved it in `/admin/business-applications`, creating business id `12b5b086-bc34-4eb2-8cf0-ad931338e85a`.
  - The admin business cards for both the original business `481ec1e2-287c-435a-9f98-d5b003dec4a7` and the newly created business show the identical owner user id `403f9ec5-14f6-4dcb-9106-35be96befb19`. This confirms applicant-to-owner assignment is correct and narrows the remaining check to current-business discovery and switching in the owner session.
  - Independent end-to-end owner-application verification on `2026-07-17`: new user `b8169872-4c24-4528-a75d-65847fc59d97` applied to the ownerless test business `3d71f584-ef14-4bcd-aecd-cd7041e82622` and to the already-owned test business `481ec1e2-287c-435a-9f98-d5b003dec4a7`. Super-admin approval made the applicant the primary owner of the first and added them as a second owner of the latter without removing user `403f9ec5-14f6-4dcb-9106-35be96befb19`.
  - Post-approval production session displayed both businesses on `/select-business`. Switching from `LIVE AUTH Business 2026071618045` to `LIVE TEST Business 20260715111633` changed the dashboard business id from `481ec1e2...` to `3d71f584...`.
  - The selected second business remained active after a dashboard reload and after direct navigation plus reload of `/dashboard/bookings`; browser console contained no warnings or errors.
- implementation notes:
  - The selector is backed by `/api/me/current-business`, which derives access only from `businesses.owner_id` and scoped `user_roles` entries with `owner`, `admin`, or `manager` roles.
  - The current production WhatsApp session still resolves one accessible business. The second business must be assigned to the same Kezek `user_id` through the existing super-admin owner-management flow; matching by phone, display name, or provider identity is intentionally not used because it could grant access to the wrong account.
  - Root cause of the original report was data ownership: `POSTFIX LINKS 12398389` was not assigned to the authenticated WhatsApp user id, so the access API correctly returned one business. Controlled same-user assignments now verify the selector and persistence path end to end.
- status: `verified`
- owner: `Codex + User`

### WB-052
- id: `WB-052`
- date: `2026-07-17`
- area: `dashboard / workspace navigation`
- severity: `P2`
- title: Desktop owner workspace sidebar cannot be collapsed
- environment: production `https://kezek.kg/dashboard`, desktop viewport
- steps:
  1. Authenticate as a business owner.
  2. Open `/dashboard` at a desktop-width viewport.
  3. Try to close or collapse the left workspace navigation.
- expected:
  - The owner can collapse the persistent sidebar to increase the workspace content area and restore it when needed.
- actual:
  - The desktop sidebar is permanently visible and has no collapse control.
  - Close/open controls exist only for the `lg:hidden` mobile drawer.
- evidence:
  - Production screenshot and live DOM on `2026-07-17` show the fixed-width `304px` workspace sidebar without a close button.
  - Source inspection confirms the desktop branch renders `WorkspaceSidebarPanel` without `closeButton` and does not persist a collapsed state.
- fix:
  - Added a reusable desktop collapsed state to `WorkspaceSidebarShell`.
  - Added explicit collapse/restore controls and animated workspace width recovery.
  - Persisted the preference under a workspace-specific browser key with a safe in-memory fallback when storage is unavailable.
  - Preserved the existing mobile drawer behavior.
  - Added component coverage for collapse, restore, and persisted-state restoration.
- post-fix evidence:
  - `pnpm --filter web typecheck` passed on `2026-07-17`.
  - `pnpm --filter web test -- --runInBand src/__tests__/components/WorkspaceNavigation.test.tsx` passed (2 tests).
  - `pnpm --filter web build` passed with Next.js `16.0.11`.
- status: `fixed locally; post-deploy live verification pending`
- owner: `Codex + User`

### WB-053
- id: `WB-053`
- date: `2026-07-17`
- area: `business staff applications / staff onboarding`
- severity: `P0`
- title: Approving a staff application grants a role but does not create a usable staff record
- environment: current production code path; source audit before live reproduction
- steps:
  1. A signed-in user submits a `staff` application through `/business/staff-apply`.
  2. A business owner approves it in `/dashboard/role-applications`.
  3. The approved user opens `/staff`.
- expected:
  - Approval completes onboarding or leads the reviewer through the required branch/profile setup before access is declared active.
  - The approved user has one active `staff` row linked by `user_id`, a valid branch assignment, and a usable staff cabinet.
- actual:
  - `approveBusinessRoleApplication()` only inserts a `user_roles` row.
  - `/staff` requires an active row in `staff` and otherwise renders `NO_STAFF_RECORD`.
  - The reviewer must separately find the user and create/link a staff card, even though the application UI reports the access request as approved.
- evidence:
  - Source audit: `apps/web/src/lib/businessRoleApplicationService.ts` approval path inserts only `user_roles`.
  - Source audit: `apps/web/src/lib/staffRoleSync.ts` resolves staff access from an active `staff.user_id` record, not from the role alone.
  - Source audit: `apps/web/src/app/dashboard/role-applications/RoleApplicationsClient.tsx` tells the reviewer to create a separate employee card after approval.
- gaps:
  - Production migration, deployment, and authenticated post-fix live verification are pending.
- fix:
  - New staff applications are restricted to role `staff`; new `manager` and `admin` requests are rejected server-side.
  - Added service-role-only RPC `approve_staff_application(...)` that locks the pending application and atomically creates or links the `staff` card, grants the scoped role, creates the active branch assignment, and marks the application approved.
  - Added a partial unique index enforcing one linked staff card per `(user_id, biz_id)` while still allowing unlinked staff cards.
  - Owner approval now requires an active branch belonging to the current business and initializes the staff schedule after the core transaction.
  - Dashboard UI uses an explicit `Настроить и принять` step; super-admin UI cannot bypass branch-aware employee onboarding.
- post-fix evidence:
  - `pnpm --filter web typecheck` passed on `2026-07-17`.
  - Targeted service and role-policy tests passed: 2 suites, 7 tests.
  - `pnpm --filter web build` passed with Next.js `16.0.11`.
  - Local browser cold-load of `/business/staff-apply` showed only the disabled `Сотрудник` role, explicit owner/branch onboarding copy, authentication gate, and no elevated-role option.
  - Production Supabase migrations `20260717020000` and corrective `20260717030000` were applied successfully on `2026-07-17`.
  - Production database lint reports zero errors for `public.approve_staff_application`; the corrective migration omits generated column `user_roles.biz_key` from inserts.
  - Production deployment `bbb78c01` reached `READY` and was aliased to `https://kezek.kg` on `2026-07-17`.
  - Production live test submitted two independent `staff` applications to `LIVE LINKS Business 11412753`: one from a client-only account and one from an owner of other businesses.
  - The target owner accepted both through `/dashboard/role-applications`, explicitly selecting `LIVE LINKS First Branch` with immediate activation.
  - UI reported both applications as accepted and confirmed that a working cabinet plus a 14-day schedule were created; browser console remained free of warnings and errors.
  - Production SQL verification confirmed for both applicants: `approved` application, active staff card, scoped `staff` role, one active branch assignment, and 14 schedule rules.
  - `/dashboard/staff` displayed exactly two active test employees assigned to `LIVE LINKS First Branch`.
  - The client-only applicant then signed in and cold-opened `/staff` and `/staff/schedule`; the correct staff card, branch, and all 14 schedule days rendered without console errors.
  - The owner applicant then signed in, opened its separate `/staff` cabinet for `LIVE LINKS First Branch`, and used the role menu to return to `/dashboard` while retaining both pre-existing owner businesses.
- status: `verified`
- owner: `Codex + User`

### WB-054
- id: `WB-054`
- date: `2026-07-17`
- area: `staff cabinet / multi-business employment`
- severity: `P1`
- title: Staff context assumes one active staff record per user across the whole platform
- environment: current production code path; source audit before live reproduction
- steps:
  1. Link one authenticated user to active staff records in two businesses.
  2. Open `/staff`.
- expected:
  - The user can select the employment/business context, or the system deterministically uses a validated current staff context.
- actual:
  - `loadActiveStaffRecord()` filters only by `user_id` and `is_active`, then calls `maybeSingle()`.
  - Multiple active employment records can therefore make staff context resolution fail instead of offering a selector.
- evidence:
  - Source audit: `apps/web/src/lib/staffRoleSync.ts` has no business/staff-context selection and expects a globally single active row.
- gaps:
  - Production live reproduction is pending creation of safe multi-business staff fixtures.
- status: `open`
- owner: `Codex + User`

### WB-055
- id: `WB-055`
- date: `2026-07-17`
- area: `shared web header / image rendering`
- severity: `P2`
- title: Shared logo emits a Next/Image aspect-ratio warning
- environment: local web `http://127.0.0.1:3000`, in-app Chromium, guest session
- steps:
  1. Cold-load `/business/staff-apply` or `/business/role-apply`.
  2. Inspect the browser console.
- expected:
  - Shared header images render without framework warnings.
- actual:
  - Next.js warns that `/logo.png` has only width or height modified and asks for an automatic counterpart dimension.
- evidence:
  - Browser console warning reproduced during the `2026-07-17` local live check of the staff-application flow.
- fix:
  - Added an explicit automatic width style to the responsive shared logo while preserving its responsive height classes.
- post-fix evidence:
  - Fresh local browser load of `/business/role-apply` produced no console warnings or errors.
  - Production live loads of `/business/staff-apply`, `/dashboard/role-applications`, and `/dashboard/staff` on deployment `bbb78c01` produced no console warnings or errors.
- status: `verified`
- owner: `Codex + User`

### WB-056
- id: `WB-056`
- date: `2026-07-17`
- area: `dashboard staff list / business context`
- severity: `P2`
- title: Staff list shows a generic business-name fallback instead of the active business name
- build: production `https://kezek.kg`; reproduced on `bbb78c01`, fixed on `4f2663cc`
- environment: in-app Chromium, production, authenticated super-admin and owner of `LIVE LINKS Business 11412753`, desktop viewport
- preconditions:
  - Select `LIVE LINKS Business 11412753` as the active owner workspace.
  - The business contains active employees.
- steps:
  1. Open `/dashboard/staff`.
  2. Inspect the business context label above the staff list.
- expected:
  - The label displays `Бизнес: LIVE LINKS Business 11412753`.
- actual:
  - The label displays the fallback `Бизнес: Ваш бизнес в Kezek` while the sidebar and loaded employee data belong to `LIVE LINKS Business 11412753`.
- evidence:
  - Production live DOM snapshot on `2026-07-17` showed business ID prefix `458193de`, two employees from `LIVE LINKS First Branch`, and the incorrect fallback label on the same page.
  - Browser console contained no errors, indicating a missing `bizName` data-propagation issue rather than a render crash.
- root cause:
  - `resolveBizContextForManagers()` validated and resolved the selected business, but dashboard pages then repeated separate metadata lookups and silently used a generic fallback when those lookups failed.
  - The centralized metadata projection initially included stale field `businesses.city`; the production schema stores `city_id` and has no text `city` column. PostgREST therefore rejected the complete multi-column select, including the valid `name` field.
- fix:
  - Added a typed, narrowly selected business metadata object to the centralized manager context.
  - Kept the service client encapsulated inside the resolver; callers receive only the authorized business record, never elevated database access.
  - Migrated dashboard home, staff, staff schedule, finance, services, bookings, branch list, and branch creation to the canonical context metadata.
  - Aligned the metadata projection with the generated production schema and normalized unresolved city metadata to `null`; metadata failures are now logged instead of being silently indistinguishable from a missing business.
  - Added resolver coverage confirming business identity and branch limit are returned with the authorized context and that the invalid text `city` projection is not requested.
- post-fix evidence:
  - Authenticated local live test as the same super-admin/owner showed exact label `Бизнес: LIVE LINKS Business 11412753` on `/dashboard/staff`; the fallback was absent and employee data remained correct.
  - Direct local loads of `/dashboard`, `/dashboard/finance`, and `/dashboard/services` displayed the exact active business name without an error boundary.
  - Direct local loads of `/dashboard/bookings` and `/dashboard/branches` retained active business ID `458193de...`, rendered their expected headings, and showed neither the generic fallback nor an error boundary.
  - Mobile live smoke at 375 CSS px showed the exact business name, a working sidebar close control, and no horizontal document overflow (`scrollWidth = clientWidth = 375`).
  - A fresh browser console contained no errors or relevant warnings during the post-fix checks.
  - Final authenticated desktop recheck after resetting the mobile viewport again showed the exact business name, no fallback, and zero console errors.
  - Resolver tests passed: 8/8.
  - Web typecheck and the Next.js `16.0.11` production build passed against the final schema-aligned projection.
  - Vercel deployment `4f2663cc` reached `Ready` and was assigned to `https://kezek.kg`.
  - Authenticated production smoke on `/dashboard/staff` showed active business and page label both equal to `LIVE TEST Business 20260715111633`; the generic fallback was absent and browser console errors were `0`.
- status: `verified`
- owner: `Codex + User`

### WB-057
- id: `WB-057`
- date: `2026-07-17`
- area: `business role applications / applicant self-service`
- severity: `P1`
- title: Owner application page logs a JSON parse error while loading the applicant's pending applications
- build: local worktree based on `10d9d2d4`, anti-abuse implementation before deployment
- environment: in-app Chromium, authenticated user, `http://127.0.0.1:3000/business/owner-apply`
- steps:
  1. Open `/business/owner-apply` as an authenticated user.
  2. Wait for the page to load the user's active owner applications from `GET /api/business-role-applications`.
  3. Inspect the browser console.
- expected:
  - The active-application panel loads or remains empty without a console error.
- actual:
  - The endpoint returns an empty/non-JSON response in the current local runtime and `response.json()` throws `Unexpected end of JSON input`.
- evidence:
  - Live DOM contained all four new proof fields and rendered the page, while browser console recorded the exception in `RoleApplicationForm.useCallback[loadMyApplications]`.
- root cause:
  - The applicant client assumed every response contained JSON; the local environment has no service-role key, so the new server route failed before producing the expected payload.
- fix:
  - The server route now converts missing service configuration into an explicit JSON `503` response.
  - The client parses the response defensively and presents safe feedback instead of creating an unhandled promise rejection.
- post-fix evidence:
  - Fresh authenticated local load rendered all proof fields and the explicit environment message with zero browser console errors.
  - `/business/staff-apply` also loaded without proof fields leaking into the staff flow and with zero console errors.
- status: `fixed locally; production verification pending`
- owner: `Codex`
