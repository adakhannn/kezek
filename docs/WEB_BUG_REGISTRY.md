# WEB BUG REGISTRY

Last updated: 2026-10-17
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

### WB-203 — Business contact settings ignore EN/KY locale

- 17Oct G129 / P2 / G2-O3. Actual owner business2 -> Settings -> EN/KY: server title, public-contact labels, ownership/sign-in separation explanation and Save button all Russian despite translated shell. Values unchanged. Expected selected UI language, authored business name untouched.
- Minimal existing server getT + client useLanguage and 18 business keys per RU/EN/KY; no ACL, query, POST, validation, response precedence, SQL or auth changes. Generic/success/network fallback messages localized too; these paths checked with mocks only.
- SAME-LIVE same owner/business2 KY localized header/form, EN settled header/form and normal reload, RU restored. Phone +996500574029/other three empty fields retained; no live typing/Save.
- Before genuine8FAIL5PASS after correcting undefined fixture (first9FAIL4PASS retained); final4s24PASS/typesPASS/scoped7filelint0/0. First extended regression4legacytests lacked language context; preserved then setup uses real RU t, assertions unchanged. Old G116coverage/G123lint failures remain.
- Separate contacts-settings surface/cause from WB140 finance and WB093 server error precedence. Component draft/error/ACL tests not live security or save proof. Oddscale screenshot not device/screenreader PASS; intermediate RSC header language lag acknowledged. Evidence apps/web/test-results/global-2026-10-17/stage-G129-business-contact-settings-locale-after.json. Source 55d631e1a66787d939855d8d5dd1b25a0c8a3a6d4e12d1ab811c7b2dec2d547f.
- Status: verified targeted SAME-LIVE; global17 distinct5/inherited2+10/whole0/NOT_READY.

### WB-202 — Profile first paint advertises an empty unlinked identity before data loads

- 17Oct G123 / P2 / E2-O3-P1 initial loading. Actual staff obraz own profile: normal RU reload briefly shows empty Name, All changes saved, active Google/Yandex Connect controls although loaded account has a name and three connected providers. G122 KY initial captured the same state. No linking action or persisted identity corruption was exercised/proven.
- Expected: until profile/identity data is known, show the existing loading boundary, not invented empty/unlinked states or actionable provider controls.
- Minimal fix: ProfileForm initial loading false -> true, reusing its existing localized loader and unchanged effect/fetch/finally. No auth/provider command, permission, query, validation, dictionary or schema changes.
- SAME-LIVE: same staff normal reload RU/EN/KY initial native AX now Loading/Загрузка/Жүктөлүүдө with no form fields/link buttons; settled same name, Google obraz, three connected providers, unchanged notifications, deletion blocked 1 role + 1 card, Save/Reset disabled. RU restored. Additional JPEG shows loaded profile, not the transient loading frame.
- Checks: genuine before 3FAIL/1PASS (both before files preserved; an unreached dictionary-key typo corrected before product edit); after 3 suites/13PASS, types PASS. Scoped lint FAIL retains the same two pre-existing no-require-imports errors (171/221 -> 172/222); new test lint 0/0, no rule suppression. Not whole green/coverage.
- Boundaries/data: successful initial-loading display only, not error/expiry/concurrent identity or full auth/security/device/E2 PASS. No Save/link/unlink/OTP/notification/delete/login/SQL/business entity or financial command. Ordinary telemetry unenumerated. Source 2c1f8335; evidence apps/web/test-results/global-2026-10-17/stage-G123-profile-initial-loading-after.json.
- Status: verified targeted SAME-LIVE; global17 distinct4, inherited16two+15ten, wholeareas0/NOT_READY.

### WB-201 — Staff statistics deduct the hourly top-up twice from a closed business share

- date: 2026-10-17 Bishkek; severity: P0 (incorrect financial aggregate); status: verified targeted SAME-LIVE G116, not whole-finance PASS.
- Real staff obraz/card1bfd -> Finance -> Statistics -> Day/native calendar13Oct: services600/staff600/business-190/late516. Expected final saved business share50, matching retained closed13Oct control; all-time business-21 instead219. Fresh UI/AX/JPEG saved before source changes.
- Cause: close_staff_shift_safe receives finalSalonShare and separate topup metadata; useShiftStats and getShiftData.stats subtracted topup240 again. Minimal two deductions removed; no stored ledger/SQL/auth/permission/command change. Negative saved shares are not clamped and guarantee semantics beyond this double deduction are unchanged.
- SAME-LIVE same13Oct RU50, initialEN50, explicitKYday13 reselected50; all-timeKY/RU219 with services901/staff781/closed3/late516 unchanged. Locale refresh resets statistics tab/date: separately pending, NOT fixed or retention PASS. FinalRUStatsAll; no shift open/close/reopen/hours/item/payment action.
- Genuine6FAIL2PASS before product patch ->3suites22PASS/typecheckPASS/scoped3filelint0errors1preexistingdependencywarning+legacyESLintIgnoreWarning. Separate coverage run22PASS but exit1: branches41.66percent below60; retained, no threshold weakening/wholegreen claim.
- Evidence: apps/web/test-results/global-2026-10-17/stage-G116-closed-stats-topup-after.json. Sourcee450164f; newrun17distinct3WB199–201/inherited16two+15ten/whole0/NOT_READY. Exactshift909/item2e5 IDs inherited, not freshly SELECT-verified; telemetryunenumerated/notzeroTOTALDBwrites. OddscaleJPEG not device proof.

### WB-200 — Authenticated booking step asks the current client to sign in again

- date: 2026-10-17 Bishkek; severity: P2; status: verified targeted SAME-LIVE G110.
- Actual pureclient low.fade / LIVE TEST CLIENT12OCT -> existing14c108 Repeat preview -> explicit19Oct/Step5: headerClient and own5bookings banner, yet RU/EN/KY top instruction asks sign-in or guest. G109 observation confirmed settled before patch; loading transient excluded. Expected guidance matches already-authenticated identity.
- Minimal BookingFormSections Step5 description uses existing isAuthed and existing localized booking.summary.selectSlotFirst, matching BookingSummary. Guest text/dictionaries/auth/commands/SQL unchanged.
- SAME-LIVE RU/EN/KY same day19/master/service31/12unselected14:15–17 slots/own5warning/disabledTime; now confirmation guidance, no repeated-login instruction. RU restored, nativeBack originalclientUpcoming5/package1of2until11Nov. No slot/hold/create/cancel/pay/authswitch.
- Genuine6FAIL0PASS before product patch ->3suites36PASS/typesexit0/scopedlint0errors2preexistingunusedwarnings plus legacyprocessnotice. Guest/identitytransition controls are component-only, not freshguestlive/authmatrix/wholeBOOK04/security/device/wholegreen PASS. Fresh oddscaleJPEG not phone/tablet proof.
- Evidence: apps/web/test-results/global-2026-10-17/stage-G110-step5-auth-guidance-after.json. Newrun17distinct2WB199+WB200; inherited16two+15ten/whole0; source0ddcd0ef. Ordinary telemetry not enumerated/notzeroTOTALDBwrites; retainedfixtures unchanged.

### WB-199 — Calendar loses selected day and branch after opening a receipt

- G117 17Oct finance-context follow-up (not new distinct): actual staff StatsDay13Oct/600-600-50 -> EN immediate retains then settledCurrentShift17off. Existing tab session persistence races with default write; period/date were only local. Scoped ownstaff server biz:staff view metadata now retains only tab/period/date/month/year through useSyncExternalStore/sessionStorage, validating fields; operationdate/items/edit/auth state not serialized. Existing getStaffContext gate unchanged, no staffId impersonation or data query changes. SAME-LIVE settledEN/KY/RU and reload retain StatsDay13/600-600-50/late516; SSRinitialCurrent17 before hydration explicitly notflashfree. First4FAIL2PASS -> effectprototype21PASS butlint1ERROR (retained/superseded) -> final3s24PASS/types/scoped4filelint0/0/hook60coveragePASS69/71statements54/62branches19/20functions. G116servicecoverage41.66branchFAIL remains, notwholegreen. Scope/legacyowner/corrupt/storagefailure controls component-only; no realfinancial/shift/auth/SQLcommands. Source9156e177; global17/stage-G117-finance-view-context-after.json; newrunfix3 unchanged.

- G114 17Oct staff-history follow-up (not new distinct): actual staff Past22 -> known034 receipt -> Back resets Upcoming5. Final minimal staff list uses Next useSearchParams/router.replace for scoped read-only staffList/past+business/staff URL; creates no booking and does not restore creation form. Server queries/auth/ACL unchanged. SAME-LIVE final EN/KY refresh ->034receipt->Back22sameorderedIDs, RUrefresh+reload22; explicitUpcoming restores5/cleanURL. Earlier raw-history, mounted-selection, native-URL prototypes failed live despite unit greens; all artifacts retained and not accepted. Original4FAIL4PASS ->final3s36PASS/types0/lint0errors1existingunusedstaffwarning+legacyprocessnotice. Own-staff UI only, not foreignscope/API/RLS/fullBOOK04/device/wholegreen. Source6c1b707a; global17/stage-G114-staff-history-context-after.json; newrunfix2 unchanged.

- date: 2026-10-17 Bishkek; severity: P2; status: verified targeted SAME-LIVE G106.
- Actual owner/business2: native calendar19Oct/branch1/five links -> existing14c108 receipt -> browserBack resets17Oct/All/defaultemptytoday. Expected selected context retained per BOOK04 contract; G105 tentative observation confirmed before product patch.
- Minimal client useCalendarHistory stores only biz/date/branch on current history entry, preserving Next metadata; useSyncExternalStore/popstate and validated currentbusiness/branch/date. No auth/session extraction, URL/permission/query/SQL/businesscommand change.
- SAME-LIVE same14c108: Back19branch1/fiveIDs-times; Forwardreceipt/Back retained; settledreload19branch1; EN/KY/RU preserved; branch2NoStaff -> restoreAll/five. Initial reload SSR17All then hydrated19branch1 observed: not flash-free/fullreload/device/security or whole BOOK04/H1/G2 PASS.
- Genuine prepatch3FAIL3PASS; final3s29PASS/types/scoped4filelint0errors0warnings+legacyprocessnotice. Firstpost12FAIL15PASS preserved: own unstable mockt timeouts and independent fixture history contamination repaired, not extra productbugs; no broad test exclusion. No fullgreen/coverage/native changes.
- Evidence: apps/web/test-results/global-2026-10-17/stage-G106-calendar-context-after.json and g106-calendar-after.jpg (oddscale, actualCSS not measured). Newrun17 one distinct fix; inherited16two+15ten/whole0/source9f9b8c4d. No businessentities/commands/SQL/cancel/pay/authswitch; telemetryunenumerated.

### WB-198 — Owner calendar accessible control names remain Russian in EN/KY

- G102 targeted fallback-tooltip follow-up (not new distinct): fresh actual EN/KY same Calendar19Oct/All/five links still had title Открыть бронь #ID. Existing localized BookingPill now supplies title ?? translated existing bookings.calendar.openBooking plus shortID; shared BookingCard and authored service summaries unchanged. SAME-LIVE allfive KY Брондоону ачуу / EN Open booking / original RU, same hrefs/time ranges/day19/All across HMR and locale switches. Before2FAIL13PASS completed before patch ->3s39PASS/types/scopedlint0/0 plus legacy process notice. Authored service-summary preservation covered in3locale unit controls, not fresh live service fixture. Resolves G101 recorded tooltip remainder only; no receipt/cancel/create/status/export/payment/SQL command; no extra distinct bug/fullarea/device/screenreader PASS. Evidence apps/web/test-results/global-2026-10-16/stage-G102-calendar-tooltip-after.json; sourceaddf6dd7/newrunfix2/inherited15fix10/whole0.
- date: 2026-10-16; severity: P2; status: verified targeted same-live G101 (two field labels only).
- Reproduced actual owner/business2/calendar19Oct/branch1: five known booking IDs and time ranges match history; EN/KY main copy translates but branch combobox remains Фильтр по филиалу and date input Дата календаря. Native OS popup language and authored branch/staff names are not this defect.
- Existing CalendarDaySection already calls t for bookings.calendar.branchFilter/date; added exactly six values to the three existing booking dictionaries. No component, query, command, permission or DB change.
- SAME-LIVE: KY Филиал боюнча чыпка / Календардын датасы, EN Branch filter / Calendar date, original RU labels; day19/branch1/five receipt links retained across locale changes. Dictionary HMR remounted calendar to16/All; native picker explicitly restored19 before repeat, not claimed HMR draft persistence. Final RU/Allbranches/day19/five links retained; no row/cancel/create/status/export/pay command.
- True before6FAIL3PASS completed before product patch; after3s32PASS/types/scopedlint0errors0warnings plus old eslintignore process notice. DOM/native AX proves accessible names, not an actual screenreader or phone/tablet PASS. Fresh oddscale JPEG records context only.
- Remaining: actual EN/KY BookingPill fallback tooltip Открыть бронь #ID stays Russian; separately recorded for targeted WB198 follow-up, not fixed by these two keys. Whole calendar/localization/accessibility/security areas stay open.
- Evidence: apps/web/test-results/global-2026-10-16/stage-G101-owner-calendar-labels-after.json, g101-calendar-en-after.jpg. Second distinct new-run16 fix; inherited15 ten unchanged, zero whole areas closed; source0d27ae99.

### WB-197 — Past restored day incorrectly allows the next booking step

- date: 2026-10-16 Bishkek (actual UTC 2026-10-15 23:00–23:11); area: D1/D2/O3; severity: P2; status: verified (targeted UI).
- before: ordinary business2/branch1 booking URL with day=2026-10-15 while Bishkek day=16 displayed past15 selected/disabled but Next enabled; real Next entered Staff with a technical error. Default day16 and disabled past calendar buttons were already correct.
- fix: pass existing business-calendar minimum/maximum into useBookingSteps; reject out-of-range forward transitions and explain recovery in RU/KY/EN. Preserve the intended date until the user explicitly selects a valid one; no silent clamp or backend/SQL change.
- SAME-LIVE: past15 Next disabled in RU/EN/KY and after reload; selecting16 enables Next, enters expected NoStaff Friday state. Final RU16 Step2; no staff/service/slot or booking/hold command.
- support: genuine prepatch 7FAIL/4PASS; postpatch 5 suites/54PASS; types PASS; scoped lint FAIL 1 pre-existing error/2 warnings. Not whole-web coverage/security PASS.
- limits: no proof of past booking creation/API/RPC/RLS vulnerability or fix; deep step5, full OAuth restoration, max-date live boundary and midnight-held-tab matrix remain unverified. No whole area closed.
- evidence: apps/web/test-results/global-2026-10-16/stage-G088-day-range-after.json and g088-past-day-blocked-ru.jpg. First new distinct fix in run16; historical WB187 map followup is separate.

### WB-196 — Escape from cabinet menu item loses keyboard focus

- date: `2026-10-15`; severity: `P2`; status: `verified targeted same-live G078`.
- Actual known pure client: Enter headerMyBookings menu, nativeTab to soleMyBookings menuitem, nativeEscape closes/expandedfalse but focus becomes BODY/AXWebArea. No role/menu navigation activated.
- Minimal fix: existing trigger button ref; after Escape close restore focus only when focus was inside this component. Outsidepointer/outsideEscape controls keep external focus. No role source/auth event/cache/permission/API or sharedDialog changes; distinct from WB184 role-staleness and WB192 rawmodal semantics.
- SAME-LIVE RU/EN/KY Enter→nativeTab→Escape returns original localized trigger; actualoutsideclickEnglish closesmenu and leavesfocusEnglish, RU restored. ExistingHistory3/review3stars/package1of2 retained; both tabs handed off. No account/role change or business command.
- True before3FAIL6PASS completed before product edit; after3s18PASS/types/scopedlint0/0. Existing mockedaccountchange/businessselector controls retained, not live foreignrole/security matrix proof. Fresh actualPNG captured once at oddscale4087×5503, CSS1277×1651/DPR≈.45, notphone-tablet/responsive/screenreader/fullF3O4 PASS. Stage-G078 before/after/focus/DOM/PNG artifacts. Global15 ten/day seven/whole areas zero, no grants/deletion/SQL/newentities.

### WB-195 — existing-session redirect leaves stale signed-out server UI

- date: `2026-10-15`; severity: `P2`; status: `verified targeted same-live G076`.
- Actual root after prior cabinet reload showed SignIn while client menu said Client. Two ordinary clicks SignIn briefly opened sign-in then returned root still SignIn; provider button disappeared before attempted click, no Google navigation. Owned server log had AuthRetryableFetchError/status0; underlying network cause or token expiry not proven.
- Minimal fix: existing-session redirect decision now calls router.refresh after router.replace, like the existing callback path, to invalidate stale server-rendered auth state. No redirect-target policy, credentials, session clearing, auth-status initial/token policy, middleware, API or authorization change.
- SAME-LIVE same rootSignIn -> settled actual LIVE TEST CLIENT12OCT/PersonalCabinet/SignOut. Ordinary own cabinet links return all5priorconfirmed IDs/times/package1of2; actualreload preserves them. History3/paid034/200som/originalreview3stars+text remain. No newOAuth/providerchooser, business commands or final cancellation; f821 untouched.
- True before2FAIL1PASS completed before edit; after3s19PASS/types/scopedlint0/0. Not full provider/expiry/replay/security matrix or repair of transient network failure. Screenshotfailed/noPNG; stage-G076 before/after/actualDOM evidence. Global15 nine/day six/whole areas zero; no credentials/grants/deletions/DBbusinesscommands, ordinarytelemetry unenumerated.

### WB-194 — booking cancellation confirmation uses identical labels for opposite actions

- date: `2026-10-15`; severity: `P2`; status: `verified targeted same-live G075`.
- Actual pure client, first confirmed14c108 booking: EN confirmation contains Cancel/Cancel; KY contains Жокко чыгаруу/Жокко чыгаруу. One closes preview, the other would cancel the booking. No final confirmation activated; no actual mistaken cancellation claimed.
- Minimal fix: two explicit confirmation-action keys in existing RU/EN/KY cabinet dictionaries and two BookingCard label props. Keep booking vs Cancel booking; Оставить запись vs Отменить запись; Жазылууну сактап калуу vs Жазылууну жокко чыгаруу. Card trigger, shared dialog, cancellation handler/API/policy unchanged.
- SAME-LIVE same14c108 preview in all3locales: distinct labels; only keep-booking action byEnter closes/restores trigger. EN actual nativeTab/Return verified; original5upcoming shown before reload/RU restored. Reload then required sign-in, cause unproven; persisted statuses not freshly reverified afterward. f821 pending final cancellation untouched.
- True before6FAIL3PASS completed before product edit; after3s24PASS/types/scoped4filelint0errors0warnings. Unit fetch mocked, no live cancellation/API/security/wholearea PASS. Screenshot attempts failed/noPNG.
- Evidence: `apps/web/test-results/global-2026-10-15/stage-G075-cancel-labels-before.json`, `stage-G075-cancel-labels-after.json`, actual DOM/focus artifacts. Global15 eight/day five/whole areas zero; no explicit review/booking/payment/package command, entities, grants or deletion. Ordinary telemetry not enumerated.

### WB-193 — switching profile language silently replaces unsaved fields

- date: `2026-10-15`; severity: `P2`; status: `verified targeted same-live G071`.
- Actual pure client/profile: invalid phone draft RU→EN disappears after loading; ordinary valid name draft EN→KY is replaced by stored name. Form then incorrectly looks clean/All changes saved despite neither Save nor Reset. Immediate KY draft was present; settled state proved the loss. Not persisted profile corruption.
- Minimal fix: per-form-instance initial-load guard; locale updates translate current state rather than call loadProfile again. Explicit identity-action reloads and callback copy remain unchanged. No API/schema/permission/validation or LanguageProvider change.
- SAME-LIVE fresh form: name and invalid phone survive RU→EN→KY→RU, localized error/Save disabled/Reset enabled retained. Explicit Reset restores initial name/empty phone/clean state; final RU reload shows original profile and same notification preferences. No Save, link/unlink, OTP or notification-setting command.
- Support: genuine before3FAIL3PASS completed before product edit; final4s15PASS/typesPASS. Same2 existing ProfileForm no-require-imports lint errors before/after, scoped lint remains FAIL. Own harness setup/alert-selector failures retained and not counted as product failure. Added remount control only in final7-case component suite, not claimed part of six-case before.
- Evidence: `apps/web/test-results/global-2026-10-15/stage-G071-profile-draft-before.json`, `stage-G071-profile-draft-after.json`, exact DOM/local field state and regression artifacts. Screenshot failed/no PNG; no visual-responsive/full-profile/identity-security PASS. Global15 seven/day four/whole areas zero. Synthetic drafts reset; f821 untouched, no DB business command/entities/grants/deletions.

### WB-192 — booking map overlay leaks keyboard focus to background actions

- G074 same-root follow-up, not a new distinct defect: existing paid03469725/revieweb51acab editor also used raw overlay. Actual native Tab escaped to background Repeat, Escape failed and rating lacked a label. Reuse existing Dialog plus associated existing labels fixes SAME-LIVE RU/EN/KY named modal, settled focus, native wrap, Escape/trigger restoration and Cancel. Local comment draft cancelled; original3stars/text restored, RU restored. No Update/Create/Repeat command. True before6FAIL3PASS →6s24PASS/types/lint0/0; stage-G074 before/after/DOM/native-focus artifacts. Screenshot failed/no PNG; not visual-responsive/screenreader/whole review-security PASS. Global15 seven/day four/whole areas zero remain unchanged.
- date: `2026-10-15`; severity: `P2`; status: `verified targeted same-live G070`.
- Actual pure client, first known14c108 booking: Enter on На карте opens raw overlay without dialog semantics. Tab reaches background Отменить, Escape does not close, visible map Close leaves BODY focus. Cancel was never activated. Expected: named modal, trapped keyboard focus, Escape and trigger-focus restoration.
- Minimal fix: reuse existing shared WEB Dialog around unchanged map host/loader; title and address become accessible name/description. No shared Dialog rewrite, map transport, permission, API, DB or dictionary change.
- SAME-LIVE: settled focus enters Close; native Tab and Shift+Tab remain inside; Escape closes and restores first original map trigger. English Close dialog and Kyrgyz Терезени жабуу controls close only map. Russian restored, five confirmed bookings retained. Initial before-RAF focus observation preserved, not called synchronous focus success.
- Support: true pre-patch6FAIL3PASS; after3s24PASS/typesPASS/scoped lint0errors0warnings. Map transport mocked pending in unit tests, not actual provider rendering. Screenshot failed/no PNG; no visual-responsive, screenreader or whole O4 PASS.
- Evidence: `apps/web/test-results/global-2026-10-15/stage-G070-map-dialog-before.json`, `stage-G070-map-dialog-after.json`, native focus/DOM artifacts. New distinct defect: global15 six/day three/whole areas zero. No booking status commands, DB entities, grants or deletions; ordinary telemetry possible; f821 cancellation untouched.

### WB-191 — selection summary drops the chosen any-master mode

- date: `2026-10-15`; severity: `P2`; status: `verified targeted same-live G069`.
- Actual pure client/business2/branch1/19Oct: select AnyMaster, Service31, reach Time without selecting a slot. The selected card and URL `staff=any` are correct, but summary says `Мастер: Не выбран` with incomplete indicator, despite12 available starts. Expected: summary represents the explicitly selected any-master mode; unselected/concrete modes stay distinct.
- Minimal fix: pass the existing staffId into BookingSummary; handle the existing `any` sentinel using the existing localized AnyMaster label and complete indicator. No availability, permission, selection, assignment, routing, creation or DB change.
- SAME-LIVE: same draft shows Любой мастер/checkmark; concrete selection changes summary to Adakhan and back to AnyMaster. Same Time step has12 unselected14:15–17:00 starts and60min100–300; EN Any master/KY Ар кандай кызматкер/RU Любой мастер, RU restored. Day20 still NoStaff/Next disabled despite retained draft; no time/hold/booking command.
- Support: true before3FAIL6PASS completed before product patch; after3s36PASS/typesPASS; scoped2files0errors3existingwarnings. New display-state defect, not WB151 in-flight command navigation, WB188 branch reset or WB190 availability. Global15 five distinct fixes/daywindow two; no whole-area PASS.
- Evidence: `apps/web/test-results/global-2026-10-15/stage-G069-any-master-summary-before.json`, `stage-G069-any-master-summary-after.json`, exact UI DOM G068/G069 and regression JSON. Screenshot failed/no fabricated PNG/visual-responsive PASS. No DB commands/entities/deletions/grants; ordinary telemetry possible, f821 cancellation untouched.

### WB-190 — booking specialist choice ignores the published off-day

- G077 same-root follow-up/notnewdistinctbug: actual paid034 Repeat restoredServiceStep4/current15Octoffday with selectedservice/Visitassembled but Nextblocked/genericFinishcurrentstep. Step3 proved actualNoStaff. Display-only empty-authoritative-projection condition now reuses existing NoStaff/chooseanotherday translations on blockedStep4, not loading/error. SAME-LIVE sameRepeat RUENKY clearreason/Nextdisabled;19Oct workingcontrol retains master/service and readyNextenabled. No gate/filter/selectionreset/SQL/command change. Truebefore3FAIL9PASS →3s38PASS/types/scopedlint0/0. Original5confirmed/History3/review3stars/package1of2 preserved, draftabandoned/RUrestored. Screenshotfailed/noPNG/notwholebooking-security-responsivePASS. Stage-G077 before/after/DOM; global9/day6/whole0 unchanged.
- date: `2026-10-15`; severity: `P2`; status: `verified targeted same-live G062, current explicit schedule mode`.
- Anonymous business2: branch1/19Oct choose master1bfd/service5157 → BackDay →20Oct →Staff. UI still offers AnyMaster/Adakhan and keeps his selected state despite copy promising date-based availability.
- Fresh addressed read-only effective schedule: same master/branch19Oct09–18;20Oct intervals empty. Final Time step correctly returns no slots and disables ChooseTime; returning19 restores12 starts14:15–17:00. No time/hold/booking command clicked and no outside-schedule booking or authorization leak demonstrated.
- Expected: the specialist list advertised as available on the chosen date respects authoritative published effective day/absence/location. Current derived list filters branch/transfers only. Retaining previous choices is an observation, not another distinct bug or a reason for blind reset.
- G062 fix: existing three-field `read_staff_work_locations` includes home working days; same signature/owner/config/service-only ACL/range guard. Existing approved-business API marks complete explicit-day data; public consumer loads one day, separates transfers, handles loading/error/stale responses, filters date/branch and gates Next without blind draft reset. No new grant, full/private schedule read, role or endpoint. One addressed dev function change applied with exact-old-definition/ACL transaction guards; reviewed migration retained, no old migrations replayed.
- SAME-LIVE: same anonymous20Oct shows no masters/Next disabled;19Oct restores master/Service31 and12starts14:15–17:00. Return20 with retainedstaff/service and reload remainsblocked; EN/KY/RU availability consistent, RU restored. No time/hold/booking command. EN/KY empty-state title remains Russian: WB189 follow-up below, not a language PASS or another distinct bug.
- Support: real before6FAIL2PASS completedbeforeproductpatch; after5suites31PASS/typesPASS/three-module60%coveragegatePASS97.14statements83.92branches100functions100lines. Scopedlint1existingimmutabilityerror3existingwarningsFAIL; historicalfullG04453/167 and G0433metadataFAIL retained, notcurrentfullgreen. Broader legacy/transfer/absence/caller/role/viewport matrix and wholeareas not closed.
- Evidence G062: `apps/web/test-results/global-2026-10-15/stage-G062-staff-day-availability-after.json`, exact UI DOM before/after/working-slots/reload, raw-DOM deployed definitions/ACL, guarded SQL. First hash guard stopped before mutation because rendered `innerText` collapsed SQL indentation; raw `textContent` hash matches server and guarded retry succeeded. Kezek screenshots failed; no visual/responsive proof claimed. Only SQL-function definition changed; no business entities/settings/deletions/native changes.
- Evidence: `apps/web/test-results/global-2026-10-15/stage-G039-date-availability.json`; actual live AX followed by known-fixture read-only schedule result. No new entities/settings/deletions/native changes.

### WB-189 — early booking wizard guidance and calendar captions stay Russian

- date: `2026-10-15`; severity: `P2`; status: `verified targeted same-live G037`.
- Anonymous business2 booking Step1/2: switch EN/KY; main step title changes, but flow guidance, kickers, branch statuses/count and calendar static ARIA/caption/legends remain Russian. Expected all product-owned static copy follows language without losing branch/date.
- Minimal fix: missing13 wizard and4 date-picker keys per locale; branch counter uses a neutral localized count template. No query, selection, availability, timezone or booking command change. Separate missing-copy root, not extra duplicate WB187 counter bug.
- Same-live EN/KY both steps now translated; branch2/day19 retained; RU restored. Dynamic KY calendar day ARIA still Russian and remains WB182 follow-up, not silently claimed fixed.
- Support:6FAIL9PASS before completed before patch; after3suites26PASS/types/scoped5fileslint0errors0warnings. Overlapping tests do not close full language coverage.
- Evidence: `apps/web/test-results/global-2026-10-15/stage-G037-early-copy-before.json`, `stage-G037-early-copy-after.json`, `early-copy-after.png`. Wide screenshot is not phone/tablet proof; no new domain entities/commands/grants.
- G063 follow-up verified: G062 actual EN/KY off-day empty title stayed Russian while body localized. Add only the missing `booking.empty.noStaffTitle` key to the three existing dictionaries. Same anonymous branch1/20Oct/Step3 now shows EN/KY/RU title and body correctly; Next stays disabled and branch/day/staff/service draft retained, RU restored. Real before2FAIL16PASS completed before dictionary edit; after18PASS/typesPASS/3dictionary lint0errors0warnings. Evidence `apps/web/test-results/global-2026-10-15/stage-G063-empty-title-after.json` and exact before/after DOM. Screenshot capture failed, no visual/responsive/full-language PASS. Follow-up of WB189, not fifth distinct global15 bug; global4/day1 unchanged, no DB commands/entities this stage.

### WB-188 — changing booking branch keeps an unavailable staff selection

- date: `2026-10-15`; severity: `P1`; status: `verified targeted same-live G036`.
- Anonymous business2 booking: branch1/day19Oct/staff1/service5157 → visible BacktoBranch → branch2 → Staff step. UI says no available specialists but keeps Adakhan in summary and `Далее` enabled. No slot or final command was clicked.
- Expected: another branch invalidates the staff and services dependent on the old branch; no available staff means Next is disabled. Same branch does not erase the draft.
- Minimal fix in selection-owner hook: user branch callback batches reset of staff/services for a different branch; internal raw setter still restores URL/OAuth choices. Date reset behavior not changed or claimed fixed.
- Same-live repeat: same branch retains chosen staff/service; switch branch2 clears both, preserves19Oct and disables Next; settled URL has no staff/service; reload preserves that state after hydration. No booking, hold, payment, grant or security/RPC fix claim.
- Support: before regression1FAIL/4PASS completed before patch; after3suites15PASS/types/scopedlint0errors. Targeted selection-hook coverage91.52%statements/76.92%branches/100%functions/92.07%lines passes60%gate. Its5tests overlap15; not fullcoverage/fullareaPASS.
- Evidence: `apps/web/test-results/global-2026-10-15/stage-G036-branch-reset-before.json`, `stage-G036-branch-reset-after.json`, `branch-reset-after.png`. Screenshot backend scaling is not responsive proof.

### WB-187 — public section counters always use plural nouns

- G098 16Oct status-count follow-up (not new distinct): actual RU business/staff summary 3 закрыта; replaced numbered state captions with 6 neutral RU/EN/KY open/closed templates in existing business and staff presentation. SAME-LIVE business Month/Year Закрытые: 3, Closed: 3, Жабык: 3; staff RU Открытые: 0 • Закрытые: 3. Both surfaces retain 1000 turnover=901services+99materials/781employee219business/3closed. Before9format-contractFAIL18PASS ->5s47PASS/types/scopedlint0/0 plus existing process notice; no financial logic/commands/SQL. Positive open-row fixtures and whole locale/finance matrix remain unverified. Separate static-RU All-branches/business prefix observed EN/KY is pending G099, not fixed here. Evidence apps/web/test-results/global-2026-10-16/stage-G098-finance-status-counts-after.json; source1e089fde/newrunfix1/inherited15fix10/whole0.
- G096 16Oct finance follow-up (not a new distinct bug): live RU 1 Клиенты / 1 Смен, EN 1 Clients / 1 Shifts, KY 1 Кардарлар / 1 Сменалар; reused existing count helper for two numbered finance labels and added 18 finance forms. SAME-LIVE 1 клиент / 1 смена, 1 client / 1 shift, 1 кардар / 1 смена; date13/expanded closed card/hours2/base360/guarantee600/topup240/650-600-50 retained through locale changes; RU restored. True pre-patch18FAIL9PASS ->5s48PASS/types/scopedlint0/0 (legacy eslintignore process notice separate). No financial calculation/commands/SQL changed. Unit0/1/2/5/11/21 are not all live fixtures; full finance/locale/device scope open. Evidence apps/web/test-results/global-2026-10-16/stage-G096-finance-counts-after.json; source0998e1d2/newrunfix1/inherited15fix10/whole0.
- date: `2026-10-15`; severity: `P2`; status: `verified targeted same-live G032`.
- Anonymous public business2: RU sections show `2 локаций`, `3 услуг`, `1 специалистов`; switch EN on the same page shows `1 specialists`. Expected nouns agree with the actual count and locale.
- Minimal fix: existing count-form helper selects dictionary one/few/many forms for the three public section counters. KY retains its numeral+noun forms. Data, links, metric cards, queries, booking commands and permissions unchanged.
- Same-live: same business2 EN `1 specialist`; RU `2 локации` / `3 услуги` / `1 специалист`; KY `2 жайгашкан жер` / `3 кызмат` / `1 адис`. Section counters only; hero/home counters and full language/responsive coverage remain open.
- Support: two suites36tests PASS, typecheck PASS, scoped lint0errors/1existing image warning. The artifact named counts-before-tests.json completed after source edits, so it is NOT a valid pre-fix failing comparison; live before AX is the reproduction proof.
- Evidence: `apps/web/test-results/global-2026-10-15/stage-G032-counts-before.json`, `stage-G032-counts-after.json`, `counts-after.png`. No new entities, deletion, grants, commit/push/deploy or native changes.
- G067 home/hero follow-up verified (explicitly excluded from G032): actual before RU `2 вариантов / 2 мест`, single-result RU `1 вариантов / 1 мест`, EN `1 options / 1 places`; exact DOM saved before product edit. Reuse existing count helper for two counters and add dictionary one/few/many forms RU/KY/EN. SAME-LIVE now RU `1 вариант / 1 место`, `2 варианта / 2 места`; EN `1 option / 1 place` and zero plurals; KY0/1/2 numeral+noun unchanged. Query/data preserved then emptyquery/RU restored. True pre-edit4FAIL14PASS ->3s35PASS/typesPASS/scoped4filelint0/0; unit0/1/2/5/11/21 boundaries, not all live fixtures. `apps/web/test-results/global-2026-10-15/stage-G067-home-counts-after.json`; screenshot capture failed/no visual-responsive/full-language PASS. Not a fifth distinct bug: global4/day1 unchanged; no search-contract change or DB commands/entities.

### WB-186 — ordinary comma in catalogue search breaks the filter

- date: `2026-10-14`; severity: `P1`; status: `verified targeted same-live G027`.
- Loggedout catalogue RU, search `Ош, улица` -> Cataloguetemporarilyunavailable alert; paired`Ош улица` -> normalempty. Existingname/address filter interpolates unquotedtext intoPostgRESTOR grammar, not a generalnetworkoutage inthiscase.
- Minimalfix: scoped app/lib publicBusinessSearchFilter; quote/escape wholeoperands, preservingtrim100/LIKEliteral escapes. Samecomma nowempty/noerror; quotes+parentheses+colon+dot validempty; knownbusiness2name still1correct. No DB/RPC/grants/service-searchfeature/native-product change.
- Primary syntax reference: [PostgREST reserved characters](https://docs.postgrest.org/en/v16/references/api/url_grammar.html#reserved-characters). Transportescaping staysapp-layer, no newdomainrule.
- Support:6newformatcasesFAILbefore,2suites8PASSafter/scopedhelpercoveragegate. Types/scopedlint savedstageproof. Full482G025precededthisfix, not currentbaseline afteredit; no wholeB1/securityexploit/phone/tablet PASS. Missingservice search staysGAP-PUBLIC-SERVICE-SEARCH, not hiddenbycopy.
- Evidence: `apps/web/test-results/global-2026-10-14/stage-G027-catalog-punctuation-before.json` / `stage-G027-catalog-punctuation-after.json`.

### WB-185 — loaded schedule draft status keeps previous language after switch

- date: `2026-10-14`; severity: `P2`; status: `verified targeted same-live G020`.
- Ordinary owner2/staff1bfd schedule KY -> load existing plan -> switchEN: allcontrols/headings become English, successnotice stays Kyrgyz. EarlierRU->KY retainedRU likewise; loaded09–18draft/currentcalendar unchanged.
- Root: translated success string stored in componentstate at action time. Fix: store existing translationkey/fallback for knownsuccessstates, render currentlocale; preserve rawserver/error text. No businessrule/endpoint/RPC/permission change.
- Same-live: KYreload/load -> ENwithoutreload nowENnotice -> RUoriginalnotice; draftMonday09–18/branch1 preserved, no publication/reset/absence command. RUrestored.
- Support: additionalregression1FAIL/1PASSbefore; final3suites34PASS/types/scoped2prodFileslint0errors0warnings. Counts overlapG019/helpertests, notwholebaseline. Otherappnotices/rawerrors andallSET03publication scenarios remainopen; no phone/tablet/visualPASS.
- Evidence: `apps/web/test-results/global-2026-10-14/stage-G020-schedule-notice-before.json` / `stage-G020-schedule-notice-after.json`.

### WB-184 — header retains old account's cabinet options after cross-tab login

- date: `2026-10-14`; severity: `P2`; status: `verified targeted same-live G016`, not a proven authorization leak.
- Keep owner-loaded publictab9; logout/login known pure client in another tab. Header updates name to LIVE TEST CLIENT12OCT but still says Owner/Ээси with BusinessCabinet menuitem. Selecting it correctly reaches serverDenied; hardreload then shows Client/onlyMyBookings.
- Cause: RoleAndBusinessSwitcher loads role/currentbusiness only once on mount, while name/RSC refresh can update without remounting this client state.
- Fix: meaningfulauthchange subscription clears old roles/openmenu immediately; defer SDK reload out of auth callback; requestgeneration blocks stale prioraccount results; unsubscribe/clear timer on cleanup. No backend/RPC/grant change.
- Same-live: publicneighbor client->anon->ordinaryGoogleowner->openownermenu->signoutother6 clearsowneroptions->ordinaryclientlogin updatesneighbor to Client/onlyMyBookings without manualreload. Ordinaryknownaccounts only/no impersonation.
- Supporting:3new casesFAILbefore +2oldPASS;4suites10PASS/types42374exit0/scopedlint0errors0warnings; rolecomponent scoped84.21statement/69.69branch/83.33function/89.24line percent. No full role/RLS/API/multi-business/revocation/mobile-layout closure.
- Evidence: `apps/web/test-results/global-2026-10-14/stage-G016-role-menu-before.json` / `stage-G016-role-menu-after.json`, `role-menu-after.jpg`. No domain/entity/grant writes, normal auth sessions only.

### WB-183 — own bookings ARIA tabs lack keyboard navigation

- date: `2026-10-14`; severity: `P2`; status: `verified targeted same-live G013`.
- Pure client -> own bookings RU -> focus selected Предстоящие tab -> ArrowRight. Focus remains Предстоящие/selected true; both tabs lack roving tabindex. Mouse История works and shows3 history records.
- Expected: horizontal ARIA tablist supports ArrowLeft/Right and Home/End with one tab stop, consistent tab/panel relationship. No booking status/permission write involved.
- Root: shared Tabs buttons only handle click; ClientCabinet sections lack tabpanel linkage. Do not alter navigation-link behavior or claim all shared consumers verified.
- Fix after480source-stable diagnostic completed: shared buttonTabs rovingfocus/ArrowLeftRight wrapandskipdisabled/HomeEnd; optional tab/panelIDs and ownClientCabinet labelledpanels. NavigationLink behavior retained.
- Same-live: original RUArrowRight nowfocus/selectsHistory; Home/End/Left/Rightwrap andKYArrowRight also pass;5future/3history/package1of2 unchanged, no booking/review command. Other shared consumers notliveclosed.
- Supporting: new4cases3FAIL1PASSbefore; final consolidated8suites58PASS/types61437exit0/scoped5fileslint0errors1oldwarning. No fullaccessibility/responsive/globalbaseline PASS.
- Evidence: `apps/web/test-results/global-2026-10-14/stage-G013-tabs-before.json` / `stage-G013-tabs-after.json`.

### WB-182 — Kyrgyz booking receipt formats date in Russian

17Oct G130 follow-up (not new distinct): actual owner branch1 KY weekly schedule showed seven Russian weekday headings. BranchScheduleEditor now reuses existing deterministic formatBookingWeekday; state/save/SQL unchanged. SAME-LIVE native UI AX KY seven corrected names, EN/RU controls, Mon09–18/contacts unchanged; 4 suites35PASS/typesPASS/scoped2filelint0/0. Blank snapshots retained, not visual/device/screenreader PASS. Evidence global17/stage-G130-branch-weekdays-after.json; count remains5/whole0/NOT_READY.

- date: `2026-10-14`; severity: `P2`; status: `verified targeted same-live G011`.
- Ordinary pure client -> own future card #f821dd52 -> Open receipt -> Кыргызча: status/help/labels localized but date remains `19 октября 2026 г. в 13:15`.
- Expected: actual Kyrgyz date locale, same booked instant/Bishkek timezone. Cause: receipt explicitly maps `ky` to `ru-KG`.
- Initial Intl ky-KG mapping fixed server reload only: deeper G014 client EN->KY toggle still produced RU date, both receipt and own history card. Preserve G011 as limited historical evidence, not final client-path closure.
- Final minimal fix: reuse existing bookingCalendarDate deterministic KY presentation (numeric business-zone parts + Kyrgyz month names), same prior RU/EN Intl format. Receipt and card share helper, no RPC/grants/booking/status/timezone change. Exact browser ICU support not directly probed; SSR/client divergence was observed live.
- Same-live: same receipt reload in KY shows `2026-ж., 19-октябрь 13:15`; EN/RU retain prior dates, same ID/status/service/master. RU restored. Screenshot `receipt-ky-after.jpg`; no mobile/tablet PASS.
- Final same-live G014: receipt EN->KY without reload and KYreload match19Oct13:15; same cancelled historya427 EN->KY yields26Oct09:00–10:00; RUrestored. No data changes or extra rootbug counted. Final screenshot attempts unavailable; initial screenshot is limited reload evidence.
- Supporting: consolidated8suites58PASS includes date/status/history/count/tab/navigation regressions;27datehelpercases scoped100%coverage/types61437exit0/scopedlint0errors1oldwarning. Whole receipt context/branch/duration/contact and language coverage remain open.
- Evidence: G011before/after retained, final `apps/web/test-results/global-2026-10-14/stage-G014-card-date-before.json` / `stage-G014-card-date-after.json`.
- G019 same-root extension: live owner/staff schedule KG still rendered seven Russian weekday headings; existing deterministic weekday formatter now shared with ScheduleEditor. Same draftMonday09–18/branch1, EN->KY all7correct/no publication; new regressionFAILbefore,3suites33PASS/types/scopedlintPASS. No extra distinctbug counted, no newstaff/fullSET03 closure. Evidence `stage-G019-schedule-weekdays-before.json` / `stage-G019-schedule-weekdays-after.json`; screenshot unavailable.
- 15OctG038 same-root calendar follow-up: actual KY publiccalendar day19 ARIA Russian despite correctKYsummary/weekdaycolumns. Existing deterministic day label now reused after converting calendar fields to the business-zone instant; RU/EN long labels unchanged. Same-live19->20->19 correctKYweekday/date/pressed state andRUEN switches; RUrestored. Before1KYFAIL2RUENPASS completedbeforepatch; after3s45PASS/types/lint0errors1existingcalendarEndwarning. No fourthdistinctnewbug, no domaincommand/fulllanguage/responsivePASS. Evidence `apps/web/test-results/global-2026-10-15/stage-G038-calendar-ky-before.json` / `stage-G038-calendar-ky-after.json`, `calendar-ky-after.png` wide/oddscale.

### WB-181 — manual staff-add safety guidance stays Russian and lookup hint has double parentheses

- date: `2026-10-14`; severity: `P2`; status: `verified targeted same-live G007`.
- Ordinary owner -> Staff -> Addstaff untouched form -> EN/KY: form/sidebar translate but warning title/message remain Russian; RU/EN/KY identifier hint has two pairs of parentheses. Fresh current DOM evidence, no account selected or role granted.
- Root: missing manualOverride title/message dictionary keys; dictionary hints already include parentheses and JSX adds another pair.
- Fix: two existing domain keys in RU/KY/EN, render hint once with parenthesized fallback. No search/API/role-grant or security changes.
- Same-live: same blankformKYreload and EN/RUswitch show localized safety guidance and single hint parentheses; original RU text retained, actualownerRU restored. No lookup/submission/account/staff/grants mutations.
- Supporting:3new regressions fail before; final4suites30PASS with existingWB178 guard/service/HTTP cases retained (27overlappingcases not added as coverage); finaltypesPASS/scopedprodFileslint0errors0warnings. Functional AX proof only; no screenshot/mobile/tablet/accessibility whole-area PASS.
- Evidence: `apps/web/test-results/global-2026-10-14/stage-G007-staff-guidance-before.json` / `stage-G007-staff-guidance-after.json`.

### WB-180 — public business landing uses Russian fallback copy on EN/KY

- date: `2026-10-14`; severity: `P2`; status: `verified targeted same-live G006`, not full-language/public area PASS.
- Existing public business2 page -> select English -> select Кыргызча. Locale buttons/ratings/service names/units change, but verified-business badge, online-booking badge, booking/branch CTA, headings, descriptions, trust points, counts, branch/staff hints and bottom CTA remain Russian. Map-link product labels also remain literal Russian.
- Expected: product UI copy follows locale; user-provided names/addresses remain stored data. Root: BusinessInfo already requests translation keys, but visible landing keys are absent from all three business dictionaries; map labels are literals.
- Fix:33 visible landing keys in existing RU/KY/EN dictionaries, reuse existing business map-label translations; no DB/profile/booking/security/layout changes. Remaining conditional promo/empty/more-card branches not silently declared verified.
- Same-live: reload sameKYpage thenENswitch shows translated product headings/actions/explanations/hints/labels/mapactions; booking destinations unchanged, stored names/addresses intact. RU restored, public still3active services; retained G005 service stays hidden.
- Supporting: new tests6FAIL before, final3suites14PASS (including6new component/dictionary/language-switch/link checks), typesPASS; scopedlint0errors/1preexistingimgwarning. No screenshot/realnarrowviewport proof, no visual/responsive PASS.
- Evidence: `apps/web/test-results/global-2026-10-14/stage-G006-public-copy-before.json` / `stage-G006-public-copy-after.json`. Count grammar e.g.EN`1 specialists` remains separate observed gap. Header`Аккаунт владельца` is user profile full_name according to AuthStatusServer projection, not a literal caption to translate; no profile rename.

### WB-179 — hidden services disappear from owner management and lose saved branch selection

- date: `2026-10-14`; severity: `P1`; status: `verified targeted same-live G005`, not whole service-management PASS.
- Ordinary owner business2 -> Add service -> new marked LIVE TEST SERVICE 14OCT G005, duration30/prices150–250/only branch2 -> uncheck Active -> Save. Returned management list has only prior active rows, no new row/filter/edit action. Addressed read-only Supabase UI confirms persisted hidden ID `e21565db-8dc1-41df-b6e3-0dc9d16b040a`. Direct normal edit page additionally leaves saved branch2 unchecked.
- Expected: hidden service remains manageable with its saved branch; public availability remains active-only. Root: list drops all inactive rows; edit loads active branch copies even for a hidden selected service.
- Minimal fix: retain fully hidden logical name groups in owner management; preserve existing branch selection of partially active groups (name-based update semantics), load edit copies matching selected visibility. No public query/RLS/grant changes; no broad service-identity rewrite.
- Same-live: original hidden ID now visible/editable with branch2 checked; edit name/duration45/prices150–275 stays hidden. Activate -> public page includes exact new values and EN/KY service names; deactivate -> public page excludes fixture and returns3active services, owner row remains manageable. Final fresh SELECT confirms sameID/branch2/activefalse/45/150/275. No staff assigned, booking, payment or original fixture mutation.
- Supporting: final5suites20testsPASS, scoped changed-page coverage list31/35statements4/4functions24/33branches, edit26/31statements2/2functions9/14branches (60gatePASS); scoped productlint0errors; finaltypecheckPASS (tsc --noEmit exit0). Screenshot unavailable; DOM/AX proof only, no responsive/visual PASS.
- Evidence: `apps/web/test-results/global-2026-10-14/stage-G005-service-lifecycle-before.json` and `stage-G005-service-lifecycle-after.json`. Retained fixture final name `LIVE TEST SERVICE 14OCT G005 EDITED`, inactive, no slot/finance effect. Mixed-visibility/name-identity/atomic-edit risks remain separate.

### WB-178 — blank staff-user lookup exposes the platform account directory

- severity: `P1`; status: `verified targeted same-live14OctG004; broader privacy scope remains open`.
- Ordinary owner business2 -> advertised `/dashboard/staff/new` -> leave search blank -> click `Найти` -> settled table lists7 platform identities with names/email, including4 nonfixture profiles. No row selected, employee created or role granted.
- Expected: request an identifier, no account directory or privileged Auth listing for a missing/whitespace query.
- Root: optional query schema, service returns all mapped Auth users for blank query, UI sends blank search. Fix must protect UI plus server/service, preserve existing access checks and canonical profile-name lookup.
- Evidence: `apps/web/test-results/global-2026-10-14/stage-G004-empty-search-before.json`; unrelated personal values intentionally masked in saved evidence. Nonblank scope remains a separate unverified privacy boundary.
- Minimal fix: mandatory trimmed HTTP query; direct-service blank short circuit before privileged Auth listing; local form guard clears rows and stale selection. Typed local-validation error follows locale changes. Existing authorization and canonical profile-name search preserved.
- Same-live repeat: blank/whitespace now show readable RU/EN/KY guidance and no account rows; exact known client lookup still returns one correct identity. No employee/account/role created. Initial stored error language was refined after an actual EN-switch observation; final error follows EN/KY/RU without another request.
- Supporting before3suites12FAIL/10PASS, final4suites27PASS; typesPASS; scopedlint0errors/1oldanywarning; servicecoverage29/30statements,8/8functions,32/43branches (60%gatePASS), notall-service/schema/release coverage. Evidence `stage-G004-empty-search-after.json`.

### WB-177 — monitoring statistics fail with a nested PostgreSQL aggregate

- severity: `P1`; status: `open`, live13Octstage050.
- NormalglobalSuperAdmin -> `/admin/monitoring` defaultStatistics afterendpointrepair shows `aggregate function calls cannot be nested`. Metricsandlogstabs separatelywork.
- Root confirmed: fresh read-only Supabase UI SELECT from pg_proc at12:32–12:33UTC13Oct confirmed deployed `get_api_metrics_stats(text,integer,text)`, SECURITYDEFINER, nests `count(*)` inside `jsonb_object_agg` for status_codes. End-to-end fix remains unverified; no SQL-function/grants/migration changes made.
- Further risk: metrics/statistics/finance-log APIhandlers lackexplicitcurrentuserguard in source; directloggedoutbrowserAPIattemptstage051 blocked `ERR_BLOCKED_BY_CLIENT`, NOT liveproof ofunauthorizedaccess. Do not call this riskfixed orreapplyoldmigration. FixstatisticalRPC only withverifiedsecurityboundary andaddresseddeployment/regressions.

### WB-176 — administrative monitoring text is mojibake

- severity: `P1`; status: `verified targeted RU`, stage050.
- Livebefore: authenticatedSuperAdmin monitoringheader/tabs/all3forms/empty/errorcopy unreadable Cyrillic bytecorruption.
- Minimal mechanicalrepair51affectedlines from reversibleWindows1251/UTF8sequences; functions/payloads/data content unchanged. No newdecoder/runtime dependency.
- Same-live after: properRussianheader, Statistics/API metrics/Operationlogs tabs, filtersandtablesloaded/readable. FullKY/ENmonitoring notclaimed.
- Evidence: stage050; AdminDiagnosticClients failbefore/passafter; types/scopedlint0errors1oldwarning.

### WB-175 — diagnostic clients call nonexistent administrative API paths

- severity: `P1`; status: `verified targeted path repair`, stage050.
- Before: healthpageHTTP404 evenRetry; Monitoringall3tabs parseHTML404asJSON. Calls`/api/admin/...`, routehandlersactually`/admin/api/...`, norewrite.
- Fix: useexistingcanonicalprotected-area paths, no newaliases/handler/grant/query changes.
- Same-live after: Systemhealth panelactualdata, Monitoringmetricstablerowsandoperationlogs actual13Octtestentries insteadof404. StatsrequestnowrevealsseparateSQLWB177, notfullmonitoringPASS. Authflowcardnot independentlyliveverified.
- Supporting3suites6tests/typesPASS; browserloggedoutAPIverificationBLOCKEDstage051, serverhandlercallercheck remainscode-onlyrisk.

### WB-174 — global super-admin diagnostic pages wrongly require tenant membership

- severity: `P1`; status: `verified targeted same-live`, stage050.
- NormalGoogleknownSuperAdmin successfullyenters/admin; advertisedSystemhealthclickanddirectsameURL andMonitoring silentlyredirect/admin. Bothpages incorrectlycallbusiness-manager context.
- Minimalfix: client-onlyplatformpagesdelegate toexisting/sharedAdminLayout scopedcurrent-userglobalSuperAdmingate, asotheradminpages. No removedAPIguard, newrole orpermissiongrant.
- Same-live positive: globalSuperAdmin reachesbothpages; same-live negative: normalGoogleownerbothURLsremainNeedsSuperAdmin/nodiagnostics. BackendAPIboundaryseparate andblocked, notclaimedsecure.
- `admin-diagnostics-before.json2FAIL`, `admin-clients-after.json3suites6PASS`, types24691PASS, E2EordinaryCUA positive/negative.

### WB-173 — package sale terms stay Russian under English and Kyrgyz UI

- severity: `P2`; status: `verified same-live EN/KY/RU`, stage04913Oct.
- Ordinaryowner/business2 QuickDesk selects knownclient61f -> Sell package -> English: translateddialog but option/selectedsummary `2 визитов,30 дн./срок,скидка`. Expected localized count/validity/discount labels, no change to user-authored planname.
- Minimal fix: one shared in-component plan-terms formatter for options andsummary,4keys inRU/KY/EN; fixed-price properly labeledpricepervisit ratherthanpercentage discount. No payload/role/query/sale changes.
- Same-live sameclient/plan47ada: ENVisits/Validity(days)/Discount, KYВизиттер/Мөөнөтү(күн)/Арзандатуу, RUВизиты/Срок(дней)/Скидка2/30/0%; Cancelcloses, no purchase/sale submitted, RUrestored.
- `stage-049-package-sale-copy.json`, pretests3FAIL, post3suites9PASS/types/scopedlintPASS. Fixed-price componentcoverageonly, no separatelivefixture; other packagepages/names languages stillpartial.

### WB-172 — hourly guarantee is presented as the top-up and obscures the original base

- severity: `P1`; status: `verified targeted same-live` (13Octstage046).
- Live before: ownerbusiness2 exactclosed13Octshift, service600/materials50/master60%. At0.02hours/rate300, guarantee6<base360 but headline/flag says top-up6. At2hours, guarantee600/base360/actualtopup240 but headline says600; expandedcard mislabeledfinal600 as base.
- Fix: additive per-shift and aggregate top-up projection (`max(0, guarantee-base)`), preserve fullguarantee separately; summary/flags consume true top-up; card uses original base_master_share. No payment, storedledger/schema/grant changes fromfix.
- Same-live after: sameclosedshift2h shows topup240/base360/guarantee600; repeat0.02h showsguarantee6/topup0/no guaranteeflag. RestoredstaffhourlyNULL andschedules; final2h fixture retained.
- Evidence: `apps/web/test-results/live-2026-10-13/stage-046-hourly-finance.json`, freshSupabaseSQL909e4eb8 topup240/guarantee600.
- Support: directJest4suites18PASS/typecheckPASS/scopedproductionlintclean, servicecoverage116/144statements15/16functions77/119branchpaths(gate60PASS), notfullsystemPASS. Hoursaudit/guarantee-exceedsreceipts remain gaps.

### WB-171 — employee statistics exclude material receipts from turnover and payout percentages

- severity: `P1`; status: `verified targeted same-live` (13Octstage046).
- Steps: ordinaryownerbusiness2 -> new13Octclosed testshift with LIVE TEST FINANCE13OCT service600/materials50 -> employeeStats.
- Before: workspace650, Stats headline/card600; employee360/business290 ratios60%/48.3%, or after2h600/50 ratios100%/8.3%, misleading commonbasis.
- Expected/after: displayturnover650 includingmaterialreceipts; at2h600/50 ratios92.3%/7.7%; at0.02h360/290 ratios55.4%/44.6%. RawAPI serviceamount semantics remain600; no doublecount/change ofpercentagebase.
- Fix: summarycommonbasis service+materials, samecardtotal; existing allstaff/currentworkspaceconsistent.
- Evidence/support: same stage046 and `finance-money-verified.json`; retainedclosedshift909e4eb8/item2e5ed7f4, settings restored. No realtransaction.

### WB-170 — application boundary intercepts Next's not-found control signal

- area/severity: P2,F2/F4/A4,13Oct17:14–17:21Bishkek.
- live before: Ownercontextbusiness1 copiedstaff2card/schedule correctlydenied but displays NEXT_HTTP_ERROR_FALLBACK;404 instead of normal404. No staff/contact/form/review data exposed.
- fix: SharedReactboundary uses publicNextnavigation unstable_rethrow forframeworksignals; ordinaryerrorfallback/monitoring remain. No privateNextimports/digestparsing or accessguardchanges. PublicAPI markedunstable upstream, pinnedcurrentNext16.0.11; upgrade requires regression.
- same-live: Samewrongcontextcard/schedule now friendly404. Restorebusiness2 viaordinarypicker: sameemployee/review/graph available, originalpreference2/RU restored, no entitywrites.
- supporting: Before3FAIL3PASS;3suites16PASS/types/scopedlintPASS; scopedcoverage21/22statements4/5functions10/15branches meets60%, not100%. IncludesactualNextnotFound/redirect/cause andordinaryerrorfallback tests.
- evidence: live-2026-10-13/stage-045-current-business-staff-guard.json; framework-boundary-before/after.json; [official control-signal API](https://nextjs.org/docs/app/api-reference/functions/unstable_rethrow).
- status: verified targeted; fullforeignrole/API matrix and404locale matrix notPASS.

### WB-169 — staff detail crashes for a unique review relation

- area/severity: P1,I3/J4/L3,13Oct16:57–17:02Bishkek.
- live before: Ordinary owner/business2→Сотрудники→Открыть staff1bfd: errorboundary booking.reviews.forEach is not a function; sameRetryfails. Prevents reaching schedule/settings.
- fix: Narrow PostgRESTadapter supports to-one review object, legacyarrays and null; preserves booking/service context and newest-first sorting. Existing managercontext/bizguard/queryscope untouched; no access expansion.
- same-live: SamepageRetry now employee/branch/active/schedulelinks render and one retainedreview rating3/editedmarker, avg3.0. No DBdatawrites orentities.
- supporting: Exactbefore1FAIL2PASS;3suites14PASS/types/adapter100% scopedcoverage; lint0errors1oldunusedwarning. Foreignstaffguard test verifies no privilegedreviewload forwrongbiz. NotfulltenantAPIproof.
- evidence: live-2026-10-13/stage-043-staff-details-review.json; staff-detail-before/after.json.
- status: verified targeted.

### WB-168 — conflict recovery refreshes slots but leaves stale own-visit count

- area/severity: P2,D6/E1,13Oct16:43–16:49Bishkek.
- live before: Two ordinary pureclient tabs select12:15; first creates06458033, second staleconfirm stayswizard/no duplicate visible and refreshes slots13:15+, but warning remains3 vsfreshowncabinet4.
- fix: Shared availability refresh lifecycle refetches current authenticated own-bookings query with slots on conflict/success/retry; guests do notforce disabledprivatequery. No polling/countfaking/auth/grants/schema changes.
- same-live: Repeatidentical two-tabsworkflow onnext13:15; firstcreatesf821dd52, second rejects with localizedbusytoast, modalcloses, count4→5 withoutreload, slotsnow14:15+. Freshcabinet5uniqueconfirmedcards, originalsunchanged/package1unchanged.
- data:06458033 19Oct12:15–13:15 andf821dd52 13:15–14:15 retained peruser, eachblocks60min; no actualpayment.
- supporting:3suites15PASS/types/refreshhookscoped100%coverage; hooklintclean, oldviewimmutabilityerror unchanged. SameaccountstaleUIonly, notmultiuser/load/fullRPC/databaseproof.
- evidence: live-2026-10-13/stage-042-stale-slot-conflict.json; stale-count-after.json.
- status: verified targeted.

### WB-167 — specialist/service selection guidance and states remain Russian

- area/severity: P2,D6/O2,13Oct16:36–16:40Bishkek.
- live before: KYstep3/4 headings translated but guidance, card available/selected ARIA+badges, estimated price, totals, ready/pending summary labels Russian.
- fix: Missing existing shared dictionary keys RU/KY/EN; no selection, availability, price, permission or stored business-name changes.
- same-live: KYselected/unselected service and staff/Any statuses correct, totals60min100–300 unchanged; English same selectedstaff/service guidance+summary localized; RU service unchanged. Originalstaff/service restored, no booking created.
- supporting: Before3FAIL6PASS; after4suites33PASS/types/scopeddictionarylintPASS. Wholewizard/phone/tablet notPASS.
- evidence: live-2026-10-13/stage-041-selector-copy.json; selector-copy-before/after.json.
- status: verified targeted.

### WB-165 / WB-166 — step5 localized copy and Kyrgyz weekday

- area/severity: P2, D6/O2,13Oct16:19–16:32Bishkek; live before preserved stage038/039.
- WB165 before: EN/KY final-summary title/loading hint Russian, selected-date duplicate colon. Added shared locale keys and removed redundant punctuation. Same EN/KY/RU title/date, actual KY/RU loading hint correct; EN loading hint rendering-tested, not separately captured afterfix.
- WB166 before: KY19Oct date/summary Russian Monday. Initial Intl solution passed Node but still failed settled browser, not counted. Deterministic KY weekday uses business-timezone ISO weekday, existing RU/EN/date-fns object formatting retained. Same KY summary/selecteddate/confirmation now дүйшөмбү, ENMonday/RUпонедельник unchanged. No slot/date command changes.
- supporting:4suites30PASS, typesPASS, helper100% statements/functions/branches; scoped view lint1preexisting immutability error confirmed HEAD. Not wholeprojectPASS.
- data: confirmation closed without creating booking; RU restored, fixtures retained. Further step3/4 mixed copy and reload selection loss observations remain open, not included as repaired.
- evidence: live-2026-10-13/stage-039-slot-copy.json; slot-copy-before/after.json.
- status: verified targeted.

### WB-164 — existing-visit warning drops the count and uses a Russian title

- area/severity: P2, D6/O2,13Oct16:08–16:13Bishkek.
- live before: Repeat futuree911 on19Oct with two existing visits: RU message «У вас уже есть активных записей…» misses count; EN header/flow translated but warningtitle Russian.
- fix: Localized warningtitle RU/KY/EN and exact{count} replacement in plural message, preserve zero/single branches. No booking/availability/auth changes.
- same-live: Samewizard count2/title correct RU/KY/EN; after normal repeatcreates thirdbooking, reloadwarning shows3 correctly.
- supporting: Before5FAIL4PASS;3suites14tests/types/scopedlintPASS. Does not prove full stale/race/API conflicts.
- evidence: live-2026-10-13/stage-038-repeat-slots.json; existing-visits-before/after.json.
- status: verified targeted.

### WB-163 — saved language starts in Russian before hydration

- area/severity: P2, O2/SSR,13Oct15:50–16:00Bishkek.
- live before: Pureclient/profile selectsEnglish and waits for loadedName; ordinary reload without codechanges starts Russian, then settles English. Preference is not permanently lost.
- fix: Pass RootLayout existing validated serverlocale into optional LanguageProvider initialLocale; initialize shared state with it. Existing standaloneRU/cookie/storage/browser fallback unchanged.
- same-live: Same EN and KY reloads first AX already shows selected locale/title/body/loadingcopy; no initialRussian in this same observation path. Not frame-level timing or full responsiveproof.
- supporting: SSRbefore2FAIL2PASS; after5suites43PASS/typesPASS. Scopedlint has identical3errors1warning on gitHEAD baseline and modified provider; no rule disabled.
- evidence: live-2026-10-13/stage-036-initial-locale.json; initial-locale-before/after.json.
- status: verified targeted.

### WB-162 — profile account-link guidance and Telegram help stay Russian

- area/severity: P2, E2/O2,13Oct15:51–15:56Bishkek.
- live before: Settled English profile has Russian connected-account explanation and Telegram secondary button; opening actual help reveals entirely Russian dialog/instructions/actions.
- fix: Add missing explanation key RU/KY/EN and use shared translations throughout TelegramAccountSwitchHelp. Provider/link URLs, callbacks and permissions unchanged.
- same-live: Reopen sameprofilehelp EN/KY/RU, translated paragraph/button/dialog/help/actions; Escape closes without linking/refresh. Restore RU before next stage.
- supporting: Before5FAIL1PASS;4suites19PASS/types/scopedlintPASS. Shared login-label tests support regression but not a new full live login claim.
- evidence: live-2026-10-13/stage-035-profile-language.json; profile-copy-before/after.json.
- status: verified targeted.

### WB-161 — staff access denial ignores selected English/Kyrgyz

- area/severity: P2, F4/O2,13Oct15:40Bishkek.
- live before: Pure client follows /staff denial then selects English; header changes but heading/help/home/account-change remain Russian.
- fix: Add missing NO_STAFF_RECORD dictionary keys RU/KY/EN. No authorization or data changes.
- same-live: Same /staff denied, EN and KY full help/actions translated, RU restored; /staff/finance also denies correctly.
- supporting: Before2FAIL5PASS, final3suites29PASS/typesPASS; scopedlint0errors1old unusedcontextwarning. Not full role/API matrix.
- evidence: live-2026-10-13/stage-034-client-boundaries.json, staff-denial-before.json, client-boundary-regression.json.
- status: verified targeted.

### WB-160 — management access denial gives database-edit instructions to clients

- area/severity: P2, F4/user-facing recovery,13Oct15:36Bishkek.
- live before: Pure client ordinary Google login then /dashboard/bookings is correctly denied, but body instructs changing user_roles/businesses.owner_id and checking server logs; development diagnostics JSON visible. No secret leak or privilege escalation claimed.
- fix: Replace the technical tutorial with account/business-owner help in RU/KY/EN; omit development JSON for NO_BIZ_ACCESS. Authentication, grants and schema unchanged.
- same-live: Same denied page ordinary reload and RU/KY/EN switch show plain localized help without table instructions or JSON. Copied ownerfinance link remains denied with correct help.
- supporting: Before3FAIL1PASS;2suites16PASS then consolidated3suites29PASS/typesPASS. Intermediate typo in new Kyrgyz link test corrected, evidence retained.
- evidence: live-2026-10-13/stage-034-client-boundaries.json; access-copy-before/after/verified.json.
- status: verified targeted.

### WB-159 — business listbox ignores Escape

- area/severity: P2, navigation/accessibility, 13 October 2026.
- live before: Owner business2 QuickDesk opens the sidebar business listbox; Escape on the active trigger leaves it open with aria-expanded=true. The same keyboard path closes the header role menu normally.
- fix: Open-only Escape listener with cleanup and trigger refocus; no business-selection requests, authorization or data changes.
- same-live: Reopen and Escape from trigger, then reopen and Escape from business1 option: both close and restore focus to business2 trigger; selected business stays unchanged.
- supporting: Before2FAIL2PASS; after3suites10tests/types/scoped component lintPASS. Full accessibility matrix not claimed.
- evidence: live-2026-10-13/stage-032-navigation-responsive.json; business-escape-before/after.json.
- status: verified targeted.

### WB-158 — client search ignores the name saved in the profile

- area/severity: P1, H4/E2, 13Oct05:45–05:52Bishkek.
- live before: OwnerQuickDesk existingclient query LIVE TESTCLIENT returned no results; sameemail low.fade found OAuthAdaханOsorov although canonicalprofile61f nameLIVE TESTCLIENT12OCT was intact. No profile overwrite claimed.
- fix: Batchload only canonical id/full_name for existing authorized Authpage IDs, prefer nonblankprofile name, preserve provider/email fallback, businessstaff exclusion and existing auth/contact/pagination rules. NoRLS/grant/schema or account changes.
- same-live: Samequery now finds LIVE TESTCLIENT12OCT; emailshows samecanonicalidentity. No new entity created.
- supporting: Before3FAIL5PASS;4suites18tests/targetedsourcecoverage/typesPASS;scopedlint0errors1oldanywarning. Scope beyond current authpage and fulltenant/role matrix remains open.
- evidence: live-2026-10-13/stage-031-profile-name-search.json; profile-search-before/after.json.
- status: verified targeted.

### WB-157 — existing-review summary uses English copy in Russian and Kyrgyz

- area/severity: P2, E4/O2, 13Oct05:30–05:37Bishkek.
- live before: After actual reviewcreate on paid03469725, RU summary says «Доступное действие Edit review» while edit button and surrounding UI are Russian; missing `actions.editReviewShort` key.
- fix: Add short-edit key RU/KY/EN; no behavior, schema, authorization or review writes in fix.
- same-live: Samecard after actualreviewupdate3stars shows Редактировать отзыв; KYПикирди түзөтүү, ENEditreview, RUrestored. Sameone revieweb51acab remains3stars, package1 unaffected.
- supporting: Before2failed/7passed;6targetedsuites27tests/types/dictionarylintPASS. General tests OOM and general lint72errors remain separate gaps.
- evidence: live-2026-10-13/stage-030-client-package-review.json and review-regression.json.
- status: verified targeted in3locales.

### WB-156 — linked existing clients appear as anonymous walk-ins in owner history

- severity/area: P2, H/QuickDesk client identity; 13Oct05:02–05:23Bishkek.
- live before: Owner business2 history exact03469725 rendered «Клиент у стойки». Primary read confirms registered client61f and NULL snapshot; canonical profile name LIVE TEST CLIENT12OCT. Legacy internalRPC intentionally stores names only for non-account walk-ins. Profiles remain self-only via RLS.
- fix: Narrow authenticated manager endpoint resolves only profile names for current-business, caller-readable, requested booking IDs. Stored snapshots take precedence; registered missing-name fallback is generic Client, not anonymous walk-in. No expanded profiles policy, grants, schema/RPC or snapshot writes.
- same-live: Same old03469725 now LIVE TEST CLIENT12OCT; local name search finds it. Ordinary new QuickDesk19Oct10–11 existing61f producede9111890, intentional snapshotNULL yet ownerhistory resolves correct profile name. Both IDs/statuses and package1 retained. No real payment.
- supporting: 5suites33tests, targeted newservices coverage above60%, typesPASS. Scopedlint0errors2existinghookwarnings. Initial test parameter/type failures retained and corrected; wholeproject/E2E/fulltenant matrix not claimed.
- evidence: live-2026-10-13/stage-029-client-identity.json; new fixture e9111890-d6e9-4dc9-a400-f32067fc0cf4 retained per user.
- status: verified targeted.

### WB-155 — receipt body keeps a separate, stale language context

- area/severity: P2, receipt locale; discovered while completingWB154 before17:00 stop.
- live before: Sameeaa3f7e5 Englishheaderpressed but bodyБронь/Неявка Russian; KYheader also didnotupdatebody.
- fix: Remove redundant nested LanguageProvider from authenticated/fallback/missing receipt branches; shared rootprovider owns selectedlocale. Data/RLS/RPC unchanged.
- same-live: SamepageEnglishBooking/No-show thenRUБронь/Неявка restored.2suites12tests/typesPASS; fullKY/visualmatrixnotclaimed.
- evidence: stage-027-no-show-presentation.json.
- status: verified (RU/EN targeted).

### WB-154 — client projection omits terminal no-show status

- area/severity: P1, D/E; actualownerNoShoweaa3f7e5 afterstart.
- live before: Primaryno_show/package2 unchanged. Receipt rawno_show; clientUpcomingcount3 includesNoShow/EnglishNoShow/emptyprogress/Cancel.
- fix: Existing domainstatus/cancellationrule; ownupcominghold/confirmed, terminalhistoryregardlessscheduledend; localizedNoShowlabels/timeline/receipt, reviewpaidonly. No permission/schema/commandchanges.
- same-live: Reload beforeend: Upcoming2/History2; sameNoShowlocalizedНеявка/noCancelReview/RepeatOpen; receiptНеявка. Package2of2 retained.
- supporting: Before10FAIL;5suites25tests/typesPASS, extended26testspass buttargetedcoverageFAIL(54.14branches/48functions). Scopedother10productfileslint0errors1oldwarning; existingBookingCardquoteerrorsremain.
- evidence: stage-027-no-show-presentation.json.
- status: verified targeted; wholeclient/financial/notification matrix incomplete.

### WB-153 — business error Retry replays the cached server failure

- severity/area: P1, B/D resilience;12Oct15:24–15:30Bishkek.
- live before: Wizardstep5→step2 triggers transientSupabaseDNSfailure; ordinaryRetry afterDNSlookup recovers stillshowsunavailable. Serveroutputno newGET. Previousstage020manualfullreload recoveredsameclassfailure.
- expected: Retry requests a fresh serverpayload and clears boundary without requiring browserreload.
- fix: Reacttransition router.refresh plus optionalboundaryreset; sharedmanual/reconnectpath, offlineclick stilldefers. No network/DBchanges.
- same-live repeat: SameerrorretainedafterHMR→Retry235→actualbusiness/calendar restoredwithbranch/date withoutmanualreload. Laterstepvalidationclearedstaff/service, notfullwizarddraftPASS.
- supporting: Before2FAIL/2PASS;2suites7tests/targetedcoverage/types/scopedlintPASS. Evidence stage-023-business-retry.json.
- limits: DNSexternalfaultnotfixed; no responsive/offlineOSnetworkmanipulation or fullresiliencematrixclaim.
- status: verified.

### WB-152 — cancellation of a future booking disappears from the client cabinet

- severity/area: P2, E/D cancellation history;12Oct14:58–15:15Bishkek.
- live before: Pureclient cancelled26Octa4278f13 normally; Upcomingcount2→1, Pastcount0/empty. PrimarySELECT proves same ownrowcancelled, no deletion.
- expected: Cancellation remains discoverable with status/receipt/repeat in own history.
- fix: Existing client_id-guarded history query includes end_at<now OR cancelled; localized History/count/empty labels explain future cancellations. No schema/permission/status changes.
- same-live repeat: Fullreload→RUИсторияcount1/samea4278f13Отменена; KYТаржымал/ENHistory samecancelledcard. Upcomingstillone14c108f6. Exact26Octwizard now09:00enabled/noalreadybookedblock: slot released, auditretained.
- supporting: Before1FAIL;4suites14tests/types/scopedquery+dictionarieslintPASS. Evidence stage-022-client-cancellation-history.json; fulltimezone/locale/tenantRPCmatrixnotPASS.
- limits: KYdateRussianmonth remains observedcopygap; no visualclaim or realpayments. No entities deleted.
- status: verified.

### WB-151 — any-master confirmation navigates away while the command is in flight

- severity/area: P1, D/E;12Oct14:32–14:54Bishkek.
- live before: Dedicated pureclient19Oct09:00/any/60min confirmation changed wizard URL to a concrete staff UUID before the command finished. Failed RSC request fell back to hard navigation; no receipt, wizard said already booked. Owncabinet/primarySELECT confirmed14c108f6 belongs to client61f7237b, correct staff/branch/09–10.
- expected: Resolve command staff without navigating away from in-flight creation; show resulting receipt.
- fix: Remove unnecessary parent staff-selection mutation from creation hook. Actual staff is local command input; guest auth-choice retains its separate resume-selection callback. No API/DB/auth changes.
- same-live repeat: Actualcalendar26Oct→Любоймастер→60min→09:00→confirm; pendingURL remainedany, then automatic confirmed receipt a4278f13 with actualstaff/date. Testauditsretained.
- supporting: Before2FAIL/2PASS; after4suites17tests/typesPASS. ScopedlintFAIL unchangedHEADview.tsxwindow.location.href rule; no fullsuite/lint/coverage claim. Evidence stage-021-any-staff-command.json.
- limits: Initial Supabase DNS ENOTFOUND external; error-boundary Retry recovery observation unresolved, not fixed here. Not simultaneous-conflict/fullbookingmatrixPASS.
- status: verified.

### WB-150 — absent daily analytics presented as calculated zeros

- severity/area: P1, G4/O2;12Oct13:38–13:50Bishkek.
- live before: Business2 Analytics shows0created/confirmedpaid/revenue for13Sep–12Oct despitepaidfixture. Readonlyprimary dailytablecount0/latestdateNULL confirms absent aggregates, notcalculatedzero.
- fix: EmptybyDay notice instead of dailyKPI/trend zero claims; localizedRU/KY/EN. Computedrowsincludingzero andfilters/hourly/errorhandling unchanged; no API/DB/cron mutation.
- same-live repeat: Sameperiod/business RU/KY/EN explicitnotcalculatedexplanation, no dailyKPIzero.5suites18tests/types/scopedlintPASS; evidence stage018.
- limits: Missingaggregation/backfill/cron remains separate operational gap. Not a fix of live propagation or numericalanalytics/fullG4PASS.
- status: verified (presentation).

### WB-149 — complex cabinet labels untranslated

- severity/area: P2, E/O2.
- live before: After full historical complex hydration, RU31a39be7 card AX56/62 shows «Services in visit» and «Total:61мин».
- expected: Selected-locale section and total labels.
- fix: Two missing section/total keys in RU/KY/EN cabinet dictionaries, no data changes.
- same-live repeat: Same31a39be7 RUУслуги визита/Всего:61мин, KYВизиттин кызматтары/Жалпы:61мин, ENServicesinvisit/Total:61min.3suites8tests/types/dictionarylintPASS; stage-017-complex-copy.json. Not fullcabinet/visualaudit.
- status: verified.

### WB-148 — cabinet loses complex services and historical duration

- severity/area: P1, D6/E1;12Oct13:21–13:25Bishkek.
- live before: Same31a39be7 cabinet60min/one service versus receipttwo services60+1=61. Repeat carriedoneID.
- fix: Existing visit-service snapshots joined in both ownclient_id guarded reads; pure normalizer supplies allservices/historicaldurations, primaryFK onlylegacyfallback. No schema/RLS changes.
- same-live repeat: Fullreloadcabinet>Past sameID61min,bothservices60/1 andrepeatURLtwoIDs. Single-servicecardsstill60. Currentcompetencevalidationunchanged.
- supporting:7suites25testsPASS,2purehelpers100%coveredstatements/functions/branches,typesPASS; scopedlintnotPASS2oldquoteerrors/1oldunusedwarning. Evidence stage-016-cabinet-complex.json.
- status: verified (targeted past complex; notfullclient/upcomingmatrix).

### WB-147 — Repeat opens business landing instead of booking flow

- severity/area: P1, D6/E1;12Oct13:08–13:16Bishkek.
- live before: ClientcabinetPast>31a39be7>Repeat navigated/b/testovyy-biznes-2 genericlanding; no bookingselection.
- fix: Semanticdirect /booking link withcontextIDs andserviceparams, no obsolete date/slot; clearoldbusinessdraftonordinaryclick. PureURLbuilder; same bookingvalidation/auth unchanged.
- same-live repeat: Samecard opens loadedstep4branch/master/selectedservice/currentbusinessday. WithWB148 complexlinkretains both historicalIDs, currentcompetencefiltersunavailableoption.
- supporting:Beforetest1FAIL;7suites25testsPASS/types/targetedhelpercoveragePASS. Existingcomponentlint2quoteerrorsremain. Evidence stage-015-repeat-booking.json.
- limits: Newrepeatbookingnot submitted/pureclientmissing; notfullD6PASS.
- status: verified.

### WB-146 — explicit staff schedule heading ignores locale

- severity/area: P2, J1/O2; 12Oct12:11Bishkek.
- live before: `/staff/schedule` KY/EN selected, AX59 heading «Моё расписание» remained Russian while calendar loading/navigation localized.
- fix: Client presentation wrapper resolves existing staff.schedule.title; server retains staff/business authorization, branches and feature switch, calendar endpoint unchanged.
- same-live repeat: RU «Расписание», KY «Менин графигим», EN «My Schedule». Existing data loaded; no schedule mutation.
- supporting: Before6targetedlocale assertionsfail (combinedWB145/146), after4suites21testsPASS, typesPASS, scopedlint0errors1existingwarning. Evidence stage-012-staff-workspace-locale.json.
- status: verified.

### WB-145 — staff sidebar mixed untranslated workspace labels

- severity/area: P2, J/O2; 12Oct12:09–12:16Bishkek.
- live before: Staff schedule RU/KY «Staff Workspace»/«Разделы workspace»; EN also Russian sectionlabel; KY schedule/finance links Russian.
- fix: Missing staff sidebar dictionary entries RU/KY/EN; KY navigation labels «График»/«Каржы». Existing shared shell unchanged.
- same-live repeat: RU «Кабинет сотрудника»/«Разделы кабинета»; KY «Кызматкердин кабинети»/«Кабинеттин бөлүмдөрү», localizedlinks; EN «Staff workspace»/«Workspace sections». RUrestored.
- supporting:4suites21testsPASS/typesPASS. No responsive/all-copy audit claim; evidence stage-012-staff-workspace-locale.json.
- status: verified.

### WB-144 — live-2026-10-12 summary localization

- severity/area: P2, K3/O2.
- before: Staff finance summary on KY and EN still showed Russian title «Сводка по смене», export button/help. Live AX observed before code changes.
- fix: Explicit RU/KY/EN summary title, export label and help dictionary entries; existing component resolves selected locale.
- same-live repeat: RU «Сводка по смене»/«Экспорт»; KY «Сменанын жыйынтыгы»/«Экспорт» and KY help; EN «Shift summary»/«Export» and EN help. RU restored.
- supporting: Before2locale failures, after5suites21testsPASS including monetary contracts; types/scoped6productfileslintPASS. Evidence stage-011-summary-revenue.json.
- limits: Does not claim staff sidebar or CSV headers fully translated.
- status: verified.

### WB-143 — live-2026-10-12 continuation observation

- date/build/environment: 2026-10-12 11:28–11:34 Bishkek; staff finance, one LIVE TEST row251service/49consumables.
- severity/area: P2, K3/K5 financial summary basis clarity.
- steps: Staff Current shift > Summary > Show details, before and after closing same single-row shift.
- expected: Overall-turnover headline identifies its basis consistently with detailTotal and displayed payout split.
- actual: Headline «Общий оборот»251, detail Services251+Consumables49=Total300, payout151+149=300. Persisted service_total251 and shares are correct; no engine formula bug claimed.
- evidence: stage-010-finance-save-duplicate.json actualAX61 and64/67 plus primaryread-onlySQL; separate observation from duplicatefix.
- fix: Shared pure presentation helper computes services+consumables once for summary card and summaryCSV; explicit components shown. Storage/service-basis input and payout engine unchanged.
- same-live repeat: Open summary RU/KY/EN300=251+49, employee151/business149. Actual RU CSV has total300/service251/cons49/split151149. Ordinary close, freshSQL and fullreload preserve the same closed summary and single item. New marked row eb63528d deleted with explicit approval; final shift closed/items0/allamounts0.
- supporting: Before3locale failures; after5suites21testsPASS, helper targeted100%coverage, types/scoped6productfileslint/whitespacePASS. Evidence stage-011-summary-revenue.json; no hourly/formula/full-project green claim.
- status: verified.

### WB-142 — live-2026-10-12 continuation-001

- date/build/environment: 2026-10-12 10:57–11:37 Bishkek; localhost staff finance, empty address-specific test shift.
- severity/area: P0, J3/K1 persisted duplicate financial entry/totals.
- steps: One Addclient, nameLIVE TESTFINANCE12OCT, assignedservice251/cons49; one Save; wait autosave/refetch; reload.
- expected: One intended financial row persists once across manual/automatic saves.
- actual before: Two rows with distinct IDs/timestamps20sec apart, same contents; persisted502service/98consumables instead251/49. ActualUI and read-onlySQL confirmed before edits.
- fix: Stable draftUUIDclientId carried by optionalstrictAPIfield, serverpersistsit once thenupdateswithinshift. Repeatinsertignoreconflict, foreignID/collisionlookuprejectbeforewrites. UIreconcilesbyidentity rather than content and ignoresservercreatedtimeforwrite-dirtysignature. No schema migration or permission expansion; intentional duplicates retain distinct keys.
- same live repeat: After explicitly authorized deletion, sameoneAdd/oneSave/elapsedautosave/reload yields exactlyone rowc8de7268. Closing preservesID andcreated05:26:22.075UTC. Open/closedpercentage60/40 split151/149 correct for251service+49consumables underexistingwhole-som rounding.
- supporting:6suites45testsPASS; targeted2modulecoveragePASS (76.10%lines/statements,61.48%branches,98.18%methods), typesPASS; scoped4productfileslint0errors16existingwarnings. No thresholdlowered or guardsremoved.
- limits: LegacyclientswithoutclientId not retry-idempotent claim; full concurrentdifferent-payload/versioning, otherfinancialmodels andtenantRPCmatrix unverified. Not whole-projectgreen.
- cleanup: Userexplicitlyapproved removing onlycreatedtestrows; all3testledgerrowsdeletedordinaryUI, unrecoverablethroughUI. FinalfreshSQL11:37shiftclosed/items0/allamounts0; no realpayment/coreaccount/businessdelete. Evidence stage-010-finance-save-duplicate.json.
- status: verified.

### WB-141 — live-2026-10-11-008

- date/build/environment: 2026-10-12 05:08–05:11 Bishkek; localhost, owner individual staff finance statistics.
- severity/area: P2, O3 accessible names for financial inputs.
- steps: Inspect period input; expand closed12Oct shift and Adjust hours; inspect accessible name.
- expected: Date and hours fields have localized accessible names.
- actual before: Native datefield only value, unassociated visible label; hour stepper only0 with no name, aria-labelnull.
- fix: Existing visible date label/input linked with ReactuseId; hours aria-label uses existing localized editHoursPrompt. No data/validation/calculation changes.
- same live repeat: Date/hours names RU Дата периода/Введите фактическое количество отработанных часов; KY Мезгилдин датасы/Иштелген сааттардын натыйжалуу санын киргизиңиз; EN Reference date/Enter actual hours worked.
- supporting: Before3newnameassertionsFAIL; after3suites17testsPASS, typesPASS, scoped2productfileslintPASS. Evidence stage-007-finance-accessible-fields.json actualAX.
- limits/cleanup: Not screenreader/whole keyboard audit; editor cancelled, RUrestored, no data writes.
- status: verified.

### WB-140 — live-2026-10-11-007

17Oct G131 narrow static business-context follow-up (not new distinct): actual owner branch edit EN showed Russian Бизнес before authored name. Two existing branches.edit keys lacked dictionary values; six RU/EN/KY values only added. Same native UI AX ENBusiness/KYБизнес/RUБизнес, unchanged authored name/contacts/hours; missing-name fallback component-only. Before6FAIL3PASS ->3s12PASS/typesPASS/scoped4filelint0/0. Screenshot capture unavailable; not visual/device/security/fulllocale PASS. Evidence global17/stage-G131-branch-business-context-after.json. Count remains5/whole0/NOT_READY.

- G120 17Oct MonthPicker follow-up (not new distinct): G120 WB140monthpickerlocaleFOLLOWUP/notnewdistinct: actualownstaffMonthNovember2026 RU dropdownEnglishNovember+Englishdategrid; EN/KYcontrolsRussianМесяц/Год. MinimalMonthPickerPopover locale=enUSorru sameexistingDatePickerKY->RUfallback +4existingdatePickerlabelkeys; no dictionaries/calendarbehavior/query/financialcommandchange. SAME-LIVE RUноябрь/RUdates; ENMonth-Year; KYАй-ЖылwithdocumentedRussiandatefallback; clicking2NovKYretainsNovzero andcloses; RUday13/600-600-50/516restored. Genuinebefore5FAIL1PASS aftercorrectingoneharnessmatcher(earlier6FAILretained) ->3s21PASS/types/scopedexplicit2filelint0/0. Englishselectedsuffix/fullKYcalendar/oddscalelayout remainOPEN—notfullO3/a11y/device/FINPASS. Newrunstill3/inherited2+10/whole0/source933418f5. Evidence apps/web/test-results/global-2026-10-17/stage-G120-month-picker-locale-after.json. No financial/booking/auth/SQL commands or new entities; existing KY->RU date fallback deliberately not presented as full Kyrgyz translation. English library selected suffix and actual oddscale layout remain unclosed.

- G099 16Oct business-finance copy follow-up (not new distinct): actual EN/KY All-branches option remains Russian and EN business-prefix remains Бизнес. Both existing components already call t; finance.branch.all and finance.biz.context missing from all three dictionaries. Added exactly6values/no component-query-finance changes. SAME-LIVE EN Business / All branches, KY Бардык филиалдар; authored business/branch names unchanged; branch2 empty -> All restores Year2026 totals1000/781/219; RU restored. Truebefore2FAIL1PASS ->3s14PASS/types/scopedlint0/0 plus existing eslintignore process notice. Resolves G098 static-copy observation only; not whole finance/localization/device/security PASS. Evidence apps/web/test-results/global-2026-10-16/stage-G099-finance-static-labels-after.json; sourcee5f30d57/newrunfix1/inherited15fix10/whole0.
- date/build/environment: 2026-10-12 about04:57–05:07 Bishkek; localhost, owner, individual employee finance statistics.
- severity/area: P2, K3/O2 observed finance copy localization.
- steps: RU header > employee Finance > Statistics > expand closed12Oct shift > Adjust hours.
- expected: Headings, period, table labels and Save use selected locale.
- actual before: Money/Guarantees/Audit, Finance filters/Reference date, summary/description English fallbacks, rawday/min, Closed, tableCLIENT/SERVICE/AMOUNT/CREATED, empty-table message and Save English.
- fix: RU/KY/EN finance keys plus common.save, t-based hardcoded metadata headings and period/minute units. Existing dictionary/provider architecture, no finance calculation/API change.
- same live repeat: Same stats/card/editor RU/KY/EN; labels and period translated, correct closed04:48 preserved. Editor cancelled, RU restored, no writes to hours.
- supporting:4suites23testsPASS (6new locale and populated-state tests), typesPASS; scoped8productfileslintPASS after routine HEAD-existing require→staticlogError import repair, not extra productbug.
- limits/evidence: stage-006-finance-translations.json actualAX before/after. FinalRU native screenshot now succeeded, no saved artifact or responsive-size PASS. Only observed normal/empty-shift page claimed; populated guarantee flags unit-supported and API-error surfaces unverified.
- cleanup: No new entities/data writes; retained previously closed empty test audit shift untouched.
- status: verified (observed copy).

### WB-139 — live-2026-10-11-006

- date/build/environment: 2026-10-12 04:31–04:48 Bishkek; localhost web, owner, empty closed LIVE TEST shift.
- severity/area: P1, K2 manual hours correction.
- steps: Employee finance statistics > expand closed shift > edit hours > clear field > Save.
- expected: Blank is rejected without writing; explicit zero remains valid.
- actual before: Empty value coerced to0, successfully saved and editor closed. Read-only SQL confirmed hours0 replaced null. Negative-1 and25 correctly rejected.
- fix: Trim input and reject empty before numeric conversion; existing0–24 bounds and API/permissions unchanged.
- same live repeat: Same blank Save displays invalid-hours message and retains editor; persisted hours remain null. Explicit2 saves and UI/SQL show2.
- supporting: Finance12suites/64testsPASS, web typesPASS, scoped product lint0errors/8existing warnings. Initial focused regression7failed/21passed; repaired stale happy-route ledger fixture without weakening409 guard.
- limits: Fixture has zero turnover and percentage model; hourly guarantee/top-up, rounding and correction audit not live verified. Targeted whole-service coverage remains below threshold (51.95% statements/lines,19.07% branches); not coveragePASS.
- cleanup/evidence: stage-005-finance-hours.json. Ordinary reopen/close restores hoursnull; closed empty audit row256a0610-676a-450b-b909-0ecccccd5edc retained, all amounts0/items0. Screenshot capture unavailable; actualAX and read-only SQL recorded.
- status: verified.

### WB-138 — live-2026-10-11-005

- date/build/environment: 2026-10-12 04:31–04:48 Bishkek; localhost web, owner current-shift workflow.
- severity/area: P1, J2/K3 manual close timestamp.
- steps: Employee finance > Current shift > Open > Close shortly after opening > Statistics > expand same shift.
- expected: Closure timestamp is the actual manual-close instant, consistent with calculation clock.
- actual before: Opened04:31, card Closed00:00; read-only SQL showed closed2026-10-13T00:00:00 for manual close on12Oct shortly after04:31.
- fix: Both owner/staff manual-close services pass now.toISOString() to existing close RPC, removing duplicated tomorrow-midnight conversion. No migration, ledger recreation, formula or permission change.
- same live repeat: Reopen/close same shift; owner card Closed04:41; SQL opened2026-10-12T04:41:17.086 and closed2026-10-12T04:41:49.36 Bishkek. Final cleanup reclose04:48:34.955 also correct.
- supporting: Twelve finance suites/64testsPASS include both services' three instant/timezone boundary cases; web typesPASS; scoped product lint0errors/8existing warnings; whitespacePASS.
- limits: Staff-provider UI not repeated this stage; its callsite supported by regressions. No bulk rewrite of historical timestamps. Whole-service coverage threshold not met, not full financePASS.
- cleanup/evidence: stage-005-finance-hours.json; retained empty closed test audit row, no client rows or money. Screenshots unavailable, actualAX plus read-only SQL.
- status: verified.

### WB-137 — live-2026-10-11-004

- date/build/environment: 2026-10-12 about04:15–04:30 Bishkek, localhost web, owner, inactive LIVE TEST promotion.
- severity/area: P2, N/O rejected promotion input feedback.
- steps: Branch1 > edit existing inactive promotion N4 > enter-1 > Save.
- expected: Rejected unsaved field with understandable localized explanation.
- actual before: Rejection correct, but toast text `validation`; user cannot see the reason.
- evidence: `stage-004-promotion-errors.json`; native tab8 AX602–604 before edits.
- fix: Existing validation supplies stable `details.field`; HTTP forwards it; UI maps fields to localized messages. No validation/authorization/status rule changes; no matching server message strings.
- same live repeat: SameN-1 rejected RU/KY/EN with explanatory count message and form retained; cancelled form and fresh reload confirm inactiveN4/title/usage0.
- supporting: Combined8suites/38testsPASS; typesPASS. Targeted5module coverage passed configured60%threshold after adding ownership/no-write/boundary contracts, not full coverage.
- limits: Scoped lint notPASS due HEAD-existing Toast set-state-in-effect error and5warnings; no suppression/unconfirmed product rewrite. Full delivery/payment/promotion-redemption not verified.
- cleanup: No new entity; invalid requests unsaved, RU restored, unchanged-save timestamps may change but values retained.
- status: verified.

### WB-136 — live-2026-10-11-003

- date/build/environment: 2026-10-12 about04:15–04:30 Bishkek, localhost web, owner.
- severity/area: P2, O3 notification accessibility/localization.
- steps: Rejected promotion SaveN-1 underRU; inspect toast close action. Independently observed earlier on cancelled booking success.
- expected: Close accessible name follows selected language.
- actual before: `Close notification` beside Russian message.
- fix: Shared Toast uses common.closeNotification through existing LanguageProvider; labelsRU/KY/EN. Existing timing/live region unchanged.
- same live repeat: Same rejected promotion request RU `Закрыть уведомление`, KY `Билдирүүнү жабуу`, EN `Close notification`.
- supporting: New3locale regressions include assertive error alert and dismissal callback timing; combined8suites/38testsPASS; typesPASS. Scoped lint existing Toast error remains.
- evidence/cleanup: `stage-004-promotion-errors.json`, actualAX before/after; no screenshot available. Existing inactive promotion restored/read after reload, RU restored.
- status: verified.

### WB-135 — live-2026-10-11-002

- date/build/environment: 2026-10-12 about 04:00–04:15 Bishkek, localhost web, owner, Cancelled booking history.
- severity/area: P1, H1 history search query reactivity.
- steps: With20cancelledrows type short/full ID4e30608a; press Enter; explicit Refresh; replace with nonexistent LIVE TEST NO MATCH12OCT.
- expected: Loaded results follow the typed query and clearing restores the page without undisclosed manual refresh.
- actual before: Query/mode changed but20rows stayed; Refresh yielded1matchingrow; subsequent nonexistent query still showed that row.
- evidence: `stage-003-history-search.json`, actual tab8 AX before edits, no screenshot available.
- fix: Keep fetched unfiltered page; memoized pure search derives visible rows on query change. No per-keystroke network traffic or changes to tenant/status queries/RLS.
- same live repeat: Same filter short/fullID→1row, no-match→0, clear→20, without Refresh.
- supporting: Before2FAIL, after3suites/11testsPASS; new helper targeted100%coverage, types PASS; scoped lint0errors/2existing hook warnings; diff whitespace PASS.
- limits: **Search beyond the loaded page is not fixed or live verified**. Dataset20/page30; global historical search/pagination remains an explicit separate gap.
- cleanup: No additional data created; prior test booking remains cancelled.
- status: verified (query reactivity).

### WB-134 — live-2026-10-11-001

- date/build/environment: 2026-10-12 about 03:50 Bishkek, localhost web, owner Test business 2, in-app browser 2.
- severity/area: P2, O3 accessibility/localization of shared dialogs.
- steps: History > Cancel future test booking 4e30608a; inspect close control; dismiss and repeat.
- expected: Accessible close name follows selected Russian language.
- actual before: `Close dialog` in an otherwise Russian confirmation, repeated twice before edits.
- evidence: `stage-002-booking-cancel.json`; actual native AX274–282. Screenshot capture failed, no visual proof claimed.
- fix: Shared Dialog resolves common.closeDialog through existing LanguageProvider, RU/KY/EN dictionary keys. Confirmation logic and permissions unchanged.
- same live repeat: Same confirmation RU `Закрыть окно`, KY `Терезени жабуу`, EN `Close dialog`; dismissal preserves confirmed status; RU restored.
- supporting: Regression initially 2 FAIL/4 PASS; after fix 4 suites/22 tests PASS, web types PASS, scoped product-file lint PASS.
- cleanup: Address-specific LIVE TEST booking cancelled normally; persisted cancelled row verified. No active test booking remains.
- status: verified.

### WB-133 — night-web-051

- date/build/environment: 2026-10-09 08:46–08:48 Bishkek; localhost web, Windows in-app Chromium, guest after normal logout.
- severity/area: P1, F4/C6 missing-session classification.
- steps: Direct open /dashboard/bookings without session.
- expected: Normal sign-in redirect; no owner data and no false network-outage claim.
- actual before: Stable «Нет соединения с сервисом» page. Server getUser returns SDK AuthSessionMissingError400/no code, wrongly treated as service failure.
- evidence: guest-dashboard-guard-stage.json actualAX13/15 and server diagnostics; fresh tab8 screenshot unavailable, not claimed.
- fix: SDK isAuthSessionMissingError recognizes the missing-session type; no message-string matching, no treating every400 as sign-out, no role/tenant guard removal.
- same live repeat: Reload same protected page →/auth/sign-in?redirect=/dashboard with normal provider actions, no failure page or owner data.
- supporting:12 business-context regressionsPASS including typed400missing-session, arbitrary400provider failure, network failure and role guards;2new tests. No whole-tenant security matrix PASS claim.
- cleanup: No business/booking/account mutations.
- status: verified.
### WB-132 — night-web-050

- date/build/environment: 2026-10-09 08:37–08:42 Bishkek; localhost web, guest, Windows in-app Chromium.
- severity/area: P2, D4/O3 guest form instructions and validation feedback.
- steps: Actual KY header →publicbranch1/12Oct/staff60min →09:00 →guest; inspect hints; submit empty name, one-letterL, markedname/emptyphone, abcphone, own validphone/invalid-email.
- expected: Named field/context explanations and validation messages use selected language; invalid forms create no booking and retain entered values.
- actual before: Five explanatory fields stayed Russian. All five invalid cases correctly rejected but with Russian validation messages.
- evidence: guest-form-language-stage.json actual AX333/335/338/341/344 and AX348 errors, before change. No screenshot capture claimed.
- fix: Existing booking guest keys populated in RU/EN/KY; hook uses localized field message after unchanged shared validators reject. No validation bypass/rule/API/server change.
- same live repeat: Same KY guest09:00 form has five KY explanations; exact five invalid cases return KY messages, form stays open with values, no receipt. Cancel resets form and RU restored.
- supporting: Real form/hook18 regressions across three locales PASS; types PASS. No provider-delivery or whole-app translation PASS claim.
- cleanup: No booking created, contacts not submitted to API; local form cancelled.
- status: verified.

### WB-131 — night-web-049

- date/build/environment: 2026-10-09 08:34–08:36 Bishkek; localhost web, guest, Windows in-app Chromium.
- severity/area: P2, D4/O3 booking-method dialog copy.
- steps: Public branch1/12Oct/staff/60min step5 →actual EN header →09:00.
- expected: Selected-time label, account/guest badges, their explanatory hints and footer use English.
- actual before: Title/actions English, six named fields Russian (AX540,543,545,547,549,550).
- evidence: booking-auth-choice-language-stage.json exact before/after AX. Tab7 screenshot unavailable, not claimed.
- fix: Six missing existing booking.authChoice keys in each RU/EN/KY dictionary; existing actions/guards unchanged.
- same live repeat: Same EN09:00 dialog shows all named fieldsEnglish; actual KY switch →same09:00 shows KY; Cancel closes without creating a booking.
- supporting: Three locale and unchanged-action component tests PASS. Keyboard live Tab/ShiftTab wrap, Escape close and slot focus restore PASS only for this dialog.
- cleanup: No booking or personal data submitted.
- status: verified.

### WB-130 — night-web-048

- date/build/environment: 2026-10-09 08:20–08:31 Bishkek, localhost web, Windows in-app Chromium, guest.
- severity/area: P2, D2/O3 common booking wizard and step5 localization.
- steps: Public business2 branch1/12Oct/staff/60min step5; use actual header EN then KY.
- expected: Common headings, step statuses, back-step accessible labels, selected-count/total and time-selection hints use selected locale.
- actual before: Those fields stayed Russian in both EN and KY. Stored service names are user data and not included in this defect.
- evidence: booking-wizard-language-stage.json; booking-wizard-ky-mixed-before.jpg; actual EN/KY AX.
- fix: Typed three-locale bookingFlow dictionary in existing translation provider; BookingSteps/BookingSummary consume it. No duplicate locale state or booking rule changes.
- same live repeat: Same step5 after reload → actual KY, EN, RU switches translate the named fields, counts and navigation. KY Тандалды:1/5-кадам/Жалпы; EN Selected:1/Step5/Total; RU restored.
- supporting: Three locale component regressions PASS; types PASS. Steps1–4-specific descriptions/date weekdays/provider dialogs are not claimed covered.
- cleanup: Read-only UI language changes; no new booking or schedule mutation.
- status: verified.

### WB-129 — night-web-047

- date/build/environment: 2026-10-09 08:20–08:31 Bishkek, localhost web, Windows in-app Chromium, normal owner logout → guest.
- severity/area: P2, D4 guest booking discovery.
- steps: Public business2 branch1/12Oct/staff/60min step5; read authentication notice; select09:00.
- expected: Explain both available account and guest paths.
- actual before: Notice claimed registration/sign-in required, although actual slot dialog offered booking without registration.
- evidence: guest-choice-stage.json; guest-choice-copy-before.jpg; actual dialog AX.
- fix: Only booking.needAuth in existing RU/KY/EN dictionaries, describing both paths and guest name/phone requirement.
- same live repeat: All three header language controls show correct notice; same RU09:00 opens account/guest choice, Cancel returns to unselected slot without a write.
- supporting: Three dictionary regressions PASS; types PASS.
- cleanup: No booking created; language returned to RU.
- status: verified.

### WB-128 — night-web-046
- date/build/environment: 2026-10-09 08:03 Bishkek; localhost web dev, guest in-app Chromium Windows.
- severity/area: P1, D guest booking/I4 temporary work location.
- steps: Owner temporarily opens branch2 Monday09-18, publishes staff19Oct branch2/day09-18/break13-14; normal logout; public branch2 service60min →12:00 →As guest →LIVE TEST name/authorized ownphone →Book.
- expected: One guest confirmed12-13 visit at published temporary branch, home/regularbranch1 unchanged.
- actual: Guest form remains open; toast209 staff not found or inactive Details:[object Object]; no receipt. Valid26slots reflect published schedule.
- evidence: tab7 live AX209 before change; guest-transfer-stage.json. Deployed hold_slot_guest definition still requires staff.branch_id=p_branch_id.
- fix: Forward20261009110000 replaces homebranch predicate with shared schedule_contains_booking and same-business active staff; deployed two-minute hold, expired-hold handling, trimmedguestcontacts, grants and serialized scheduling triggers preserved. Applied+registered once.
- same live repeat: Same guestform12:00 Book →confirmedreceipt42aa38a2-d0db-4920-9759-6838d46be7d4 on19Oct12:00,60min. Screenshot guest-transfer-confirmed.jpg.
- supporting: Disposable PostgreSQL old homebranch rejection →new allows temporarybranch exactbreakboundary; rejects liveholdoverlap/break/wrongbranch/foreigntenant/emptycontacts/inactivestaff; expiredhold frees slot; homebranchunchanged. No simultaneous-race PASS claim.
- cleanup: Normal UI exactbooking cancellation/day RestoreRegular/branch Monday interval removal. ReadonlySQL confirms cancelled, effective19Octsourceweek/homebranch1 09-18, branch2sevenclosed days. No purge/permanenttransfer.
- status: verified.

### WB-127 — night-web-045
- date/build/environment: 2026-10-09 07:50–08:00 Bishkek; localhost web dev, Windows in-app Chromium, guest after normal owner logout.
- severity/area: P2, D guest multi-service receipt.
- steps: Public branch1/12Oct/staff select60+1 minute services →09:00 →continue as guest →LIVE TEST name and authorized own phone →submit →receipt dba70dc9-e061-4a3e-8e54-413f9999c884.
- expected: Receipt shows both selected services and total61min, as authenticated receipt does.
- actual: Confirmed receipt shows only primary service and no total duration. Live Supabase read-only proof confirms both booking_services rows60+1 and booking end10:01: no booking data loss.
- evidence: tab7 live receipt AX; Supabase table proof {minutes:61,services:[primary60,secondary1]}; complex-stage.json.
- diagnosis: Guest RLS fallback booking_view_public returns only primary service_name; FallbackBooking constructs one service with null duration.
- fix: New narrow booking_receipt_public(uuid) returns ordered localized names and snapshot durations, keeping existing legacy RPC unchanged. Explicit empty search_path, no contacts/client ID/internal notes/ledger, anon direct table reads remain denied. Fallback uses this receipt composition.
- same live repeat: Normal owner logout →same guest receipt reload →both60+1 services and total61 visible. Main-tab screenshot guest-complex-receipt.jpg. Forward20261009105000 applied and registered once.
- supporting: Disposable PostgreSQL ordered two-service/localized/single/cancelled/unknown-ID/no-PII/direct-table-denied checks PASS; guest receipt component3tests PASS.
- cleanup: Normal owner exact-ID CancelConfirm; Supabase read-only status cancelled. Original competency restored: primary60 checked, temporary1min unchecked. No record purge.
- status: verified.

### WB-126 — night-web-044
- date/build/environment: 2026-10-09, localhost web dev based on7f5c8ae; Windows in-app Chromium, normal Google owner acting as client.
- severity/area: P1, D authenticated multi-service booking.
- steps: Temporarily assign existing1min service to active staff, preserving60min. Publicbranch1/12Oct →staff →both services →61min/100–600 →09:00 →reviewbothnames →Confirm.
- expected: Oneconfirmed09:00–10:01 booking, ordered composition retained, identity email and profile contacts.
- actual before: No receipt; confirmation remains open, toast column email does not exist Details:[object Object] Code:internal; quick-hold500. Exact liveAX toast301, complex-stage.json.
- diagnosis/fix: Deployedhold_complex_slot selects nonexistent profiles.email. Forward20261009104000 only replaces clientcontact query with profiles join auth.users/currentauth.uid; keeps profile requirement, holds, services/order, validation, triggers and existing privileges. Applied and registered once.
- same live repeat: Same pending09:00 review →Confirm →confirmedreceipt31a39be7-f730-45e7-9833-577943017c79; bothservices60+1 andtotal61 visible,12Oct09:00. Tab7screenshot unavailable, liveAX retained.
- supporting: Disposable PostgreSQL firstreproduces missingcolumn then verifies identityemail/profilecontacts/61min/orderedcomposition/holdexpiry; rejects overlap/break/foreignservice/emptycomposition/anonymouscaller. Not a multiconcurrency claim.
- cleanup: Both authenticated and guest complex visits cancelled normally; original secondary competency restored unchecked; primary60min preserved. Seecomplex-stage.json.
- status: verified.

### WB-125 — night-web-043
- date/build/environment: 2026-10-09, localhost web dev based on 7f5c8ae; Windows in-app Chromium, normal Google owner acting as client.
- severity/area: P1, D booking / J effective schedule work location.
- steps: Publish only19Oct09–18/break13–14 in branch2 (temporarily open Monday branch2), preserving regular branch1. Public branch2 →19Oct →active Adahan →branch2 60-minute service →12:00 →review →Confirm.
- expected: Published date-specific work location permits one booking12–13 without permanently transferring the employee.
- actual before: Review and26 slots correct; confirmation remains open, staff not found or inactive /not_found, no receipt.
- evidence: transfer-stage.json exact AX steps; transfer-published.jpg owner publication. Public-tab screenshots unavailable; not claimed.
- fix: Forward migration20261009103000 only authenticated hold_slot; validate active staff in same business and whole interval through shared schedule_contains_booking instead of permanent home branch. Keep identity/contact/confirmed contracts, privileges and serialized trigger unchanged. Guest deployed function differs from repository baseline and was not overwritten based on suspicion.
- same live repeat: Pending12:00 review →Confirm →confirmed receipt de87ce82-9d93-44c6-a514-bdcbe2fcebdf19Oct12:00; owner history shows branch2 and12–13. Screenshot transfer-booking-confirmed.jpg.
- supporting: Disposable PostgreSQL reproduces old rejection and verifies new transfer, break boundary, regular day; duplicate, break, wrong branch, absence, foreign business, inactive staff and anonymous caller rejected. Existing schedule/reset scripts PASS. Single-session tests are not a multi-session concurrency claim.
- cleanup: Normal owner cancelled exact booking; restored19Octregular branch1 and removed only temporaryMondaybranch2 hours. Supabase read-only query confirms cancelled and restored effective regular schedule/all seven branch2 days closed. Audit retained.
- status: verified.

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

## Ночной живой прогон 2026-10-09 — новые проверенные исправления

Начальный блок ночи перенесён из stage-файлов без повторной выдуманной проверки. Для WB-115–124: Windows, встроенный браузер, localhost:3000, commit `7f5c8ae` + ночные изменения; date `2026-10-09`, status `verified`. Точные исходные наблюдения/повторы — в указанных stage-файлах.

### WB-115 — night-web-001
- area: `G1 / O2`; severity: `P2`; title: Счётчик готовности русского кабинета показывает «1 open».
- steps: владелец → главная кабинета → блок готовности → RU/KY/EN.
- expected: локализованная подпись оставшегося шага; actual before: английское open в RU.
- fix: существующие словари dashboard; live after: «Осталось:1» / «Калды:1» / «Remaining:1».
- evidence: progress.json liveResults, owner-dashboard-before.jpg; supporting: 4 компонентных теста PASS.

### WB-116 — night-web-002
- area: `I2 / O2`; severity: `P2`; title: Длительность услуги сотрудника отображается испорченной кодировкой.
- steps: владелец → сотрудник Адахан → компетенции; expected: читаемая локализованная длительность; actual before: `60 РјРёРЅ`.
- fix: использовать существующий ключ duration; live after: после обновления `60 мин`, `1 мин`.
- evidence: owner-stage.json; supporting: 1 компонентная регрессия PASS.

### WB-117 — night-web-003
- area: `L3 / O2`; severity: `P2`; title: Период рейтинга сотрудника выводит шаблон {days}.
- steps: владелец → сотрудник → рейтинг; expected: текущий настроенный период; actual before: буквальный `{days}`.
- fix: подставить ratingWeights.windowDays; live after: 30 дней после обновления.
- evidence: owner-stage.json; supporting: регрессия с нестандартными45 днями PASS.

### WB-118 — night-web-004
- area: `C3 / D2`; severity: `P1`; title: Google-вход из записи теряет явное место возврата и отправляет в кабинет роли.
- steps: гость → бизнес2/запись/шаг5 12.10 →09:00 → Через аккаунт → Google obraz.osh.
- expected: тот же поток записи; actual before: `/staff` вместо переданного безопасного next.
- fix: единая существующая логика выбора безопасного явного внутреннего назначения перед ролью; исключить дублирование callback-решения.
- live after: тот же Google возвращает шаг5/день/филиал/сотрудника. Сервисное восстановление отдельно WB-119.
- evidence: client-stage.json; supporting: 3 набора19 тестов PASS, небезопасные next и роль по умолчанию включены. Аккаунт реально связан с сотрудником, не объявлен чистым клиентом.

### WB-119 — night-web-005
- area: `D2`; severity: `P1`; title: Асинхронный старт записи удаляет корректную услугу из URL.
- steps: открыть/обновить сохранённый step5 URL бизнеса2 с филиалом1, 12.10, сотрудником и60-минутной услугой.
- expected: сохранить услугу до загрузки каталога; actual before: услуга исчезает, длительность0, нет слотов.
- fix: не записывать пустой первоначальный render в URL, дождаться восстановления и каталогов перед отсевом ID.
- live after: тот же URL восстанавливает60 минут, слоты09–17 и диалог подтверждения.
- evidence: client-stage.json; supporting: 3 hook-регрессии/типы PASS.

### WB-120 — night-web-006
- area: `E2 / O2`; severity: `P2`; title: Сводка, история и отмена клиентской записи смешивают языки.
- steps: реальная подтверждённая запись → кабинет/брони → RU/KY/EN → отмена.
- expected: текущий язык; actual before: английские Date and time/Duration/Next action в RU, русская история в EN/KY, Cancel booking? в RU.
- fix: недостающие ключи существующих словарей; live after: сводка/история трёх языков, RU «Отменить запись?».
- evidence: client-stage.json; supporting: 3 регрессии PASS. Общий KY Intl ru-KG формат дат не объявлен полной языковой проверкой.

### WB-121 — night-web-007
- area: `J3`; severity: `P2`; title: В выходной сотруднику предлагают открыть недоступную смену без объяснения.
- steps: опубликованный выходной09.10 → сотрудник/финансы → текущая смена → клиенты → текущая смена.
- expected: явное объяснение запрета; actual before: «Смена не открыта», клиенты отправляют к отсутствующей кнопке.
- fix: сделать существующее объяснение выходного достижимым; блокировать изменение до загрузки авторитетной доступности.
- live after: тот же день «Сегодня у вас выходной», открыть нельзя.
- evidence: staff-stage.json, staff-day-off-before.jpg; supporting: 5 компонентных регрессий PASS.

### WB-122 — night-web-008
- area: `J4 / O3`; severity: `P2`; title: Название выбранной даты/месяца содержит {value}.
- steps: сотрудник/финансы → статистика → День →12.10 → Месяц.
- expected: доступное имя с выбранным значением; actual before: «Выбранная дата/месяц:{value}» в живом AX.
- fix: интерполировать ключи picker; сохранить стабильный порядок hooks при смене языка.
- live after: RU/EN/KY доступные имена с датой/месяцем без шаблона.
- evidence: staff-stage.json; supporting: 6 picker-регрессий PASS.

### WB-123 — night-web-009
- area: `J3 / O2`; severity: `P2`; title: Подсказка имени клиента ручной смены показывает {name}.
- steps: открытая смена → Клиенты → Добавить, затем редактировать сохранённую позицию.
- expected: ясное объяснение редактируемого имени по умолчанию; actual before: буквальный{name}.
- fix: корректная формулировка существующих словарей трёх языков, без изменения сохранения.
- live after: повторно открытая форма содержит объяснение без шаблона, тестовое имя сохранено.
- evidence: staff-stage.json; supporting: 3 регрессии реальной формы PASS.

### WB-124 — night-web-010
- area: `J3 / K5`; severity: `P1`; title: Сохранённые клиенты исчезают из закрытой смены сотрудника.
- steps: открыть смену → сохранить300/50 → изменить301/49 → обновить → закрыть → Клиенты(1).
- expected: сохранённый список только для чтения; actual before: предлагает открыть смену вместо списка, хотя счётчик1 и суммы сохранены.
- fix: не считать закрытую смену с позициями отсутствующей, разрешить чтение и запретить add/edit/delete.
- live after: тот же закрытый список виден, без редактирования и удаления.
- evidence: staff-stage.json, closed-shift-items-before.jpg; supporting: 4 регрессии PASS. Сохранение ledger ID при закрытии отдельно WB-083/WB-107.

### WB-114 — night-web-042
- date: `2026-10-09`; area: `D3 / G3 / N3`; severity: `P2`; status: `verified`
- title: Успешная гостевая запись отсутствует на последнем шаге публичной воронки.
- steps: после восстановления хранилища пройти обычную гостевую запись до подтверждённой квитанции; суперадмин → Воронка → Public; сверить сохранённые события через read-only SQL UI.
- expected: успешная гостевая команда создаёт `booking_success` в той же анонимной сессии, без персональных контактных данных.
- actual before: две подтверждённые гостевые квитанции, 7 событий шагов, но 0 успешных записей/0% конверсии.
- fix: после успешной команды гостевой hook использует существующий трекер с фактическими ID услуги/сотрудника/брони и общей session ID. `keepalive` защищает отправку при немедленном переходе к квитанции; успех не блокируется аналитикой. Старые события не выдумываются задним числом.
- live verification: тот же гостевой сценарий создал `bb896eb9`; квитанция подтверждена, SQL показывает одну строку `booking_success/public` с тем же ID. Обычный вход суперадмина → Воронка показывает просмотры1/успех1/100%/10 событий.
- evidence: `funnel-stage.json`, `admin-funnel-data-after.jpg` до исправления, `admin-funnel-guest-success-after.jpg` после.
- supporting: 5 наборов / 13 тестов PASS, типы PASS; guest hook scoped lint PASS. Две прежние ошибки no-console в funnelEvents.ts не объявлены новым продуктовым багом или общим lint PASS.
- cleanup: обычная отмена владельцем завершена07:17, active0/toast; SQL statuscancelled/guesttrue. История сохранена, guest-stage.json/guest-final-cancelled.jpg.

### WB-112 — night-web-040
- date: `2026-10-09`; area: `G3 / N3 / Q1`; severity: `P1`; status: `verified`
- title: Гранулярная воронка не имеет своей таблицы событий в основной базе разработки.
- steps: суперадмин → Воронка → Повторить после исправления адреса API; обычный публичный поток записи → проверить события и страницу аналитики.
- expected: события сохраняются, аналитика читает их без 500.
- actual before: HTTP500 на странице; сервер public.funnel_events not found, SQL to_regclass NULL.
- fix: две новые forward-миграции создают отдельную гранулярную модель с RLS, серверным доступом и ограничением существующей maintenance-функции. Не смешивалась с coarse analytics_events; история задним числом не выдумывалась.
- security: API отдельно проверяет текущую глобальную роль суперадмина до использования server client; гостевой/обычный пользователь не получает доступ к сырой таблице. SQL подтвердил anon/authenticated SELECT/INSERT/retention EXECUTE false, service_role true. API negative unit401/403/503 PASS, прямой live API blocked browser policy, не выдан за live PASS.
- live verification: обычный вход суперадмина → тот же переход → 7 событий/1 сессия, SQL группировка совпадает; фильтр Public7, QuickDesk0. Необходимость гостевого success-события отдельно night-web-042.
- evidence: `funnel-stage.json`, `admin-funnel-schema-before.jpg`, `admin-funnel-data-after.jpg`.
- supporting: 6 наборов / 15 тестов PASS, типы PASS, scoped lint без ошибок/один прежний warning.
- migration: `20261009100000_create_funnel_events.sql`, `20261009101000_restrict_funnel_retention.sql` применены и зарегистрированы один раз. Старые миграции не переигрывались; не запускалась удаляющая maintenance-функция.

### WB-113 — night-web-041
- date: `2026-10-09`; area: `D3 / N1`; severity: `P1`; status: `verified`
- title: Гостевая запись создаётся, но внутренний запрос отправки уведомления теряет авторизацию.
- steps: выйти обычным способом → публичная запись бизнеса 2 → филиал 1, сотрудник Адахан, услуга 60 минут → 12.10 09:00 → «Как гость» → тестовые имя/разрешённый номер без email → отправить; проверить квитанцию и открытый Kezek Auth Bot.
- expected: квитанция подтверждена, включённые уведомления владельцу/сотруднику отправлены.
- actual before: `76d7470f` подтверждена, внутренний `/api/notify` отвечает 401, Telegram не получает подтверждение.
- fix: приватный адаптер после успешной гостевой команды проверяет точное соответствие сохранённой гостевой записи ID/бизнесу/филиалу/сотруднику/времени/статусу. Общий механизм доставки читает участников сервером без создания/подмены пользовательской сессии. Защита публичного `/api/notify` не ослаблена; HTTP-запрос к самому себе устранён.
- live verification: тот же гостевой сценарий создал `e8d0c8e3`; квитанция подтверждена, Telegram-сообщение с тем же ID пришло 06:57. WhatsApp API принял отправку владельцу; чтение/доставка на устройство отдельно не подтверждены. Email 403 — известный неоплаченный домен.
- evidence: `guest-stage.json`, `guest-notification-before.jpg`, `guest-notification-after.jpg`, server10568.
- supporting: 5 наборов / 33 теста PASS; типы/scoped lint PASS; scoped coverage 92.3% statements, 81.81% branches, 100% functions. Это не весь notification retry/idempotency набор.
- cleanup: обе тестовые записи подлежат обычной отмене владельцем с сохранением аудита; актуальное состояние в guest-stage.json.

### WB-111 — night-web-039
- date: `2026-10-09`; area: `G3 / Q1`; severity: `P1`; status: `verified`
- title: Клиент глобальной воронки обращается к несуществующему адресу API.
- steps: суперадмин → Разделы → Воронка → Повторить.
- expected: запрос к существующему обработчику `/admin/api/funnel-analytics`.
- actual before: видимая HTTP 404, запрос к `/api/admin/funnel-analytics`.
- fix: исправлен адрес клиентского запроса без создания дублирующей маршрутизации.
- live verification: тот же Retry достигает правильного обработчика; 404 исчезает. Следующая 500 из-за отсутствующей таблицы отдельно night-web-040, не выдавалась за успешную загрузку данных.
- evidence: `funnel-stage.json`, `admin-funnel-route-before.jpg`, `admin-funnel-schema-before.jpg`.
- supporting: 2 новых клиентских регрессии PASS; глобальная страница и role helper также PASS.

### WB-110 — night-web-038
- date: `2026-10-09`; area: `F1 / G3`; severity: `P1`; status: `verified`
- title: Глобальная аналитика суперадмина требует выбранный бизнес и перенаправляет обратно.
- steps: обычный Google-вход kezekkg → `/admin` без бизнес-роли → Разделы → Воронка.
- expected: доступна глобальная воронка платформы для суперадмина.
- actual before: возвращает `/admin`, сервер NO_BIZ_ACCESS.
- fix: убрана вложенная проверка бизнес-контекста; неизменённая глобальная проверка `/admin/layout` сохраняется.
- live verification: тот же пункт открывает заголовок и фильтры `/admin/funnel-analytics`, без перенаправления. Обычный владелец через штатный вход получает отказ NeedSuperAdminRole.
- evidence: `funnel-stage.json`, `admin-funnel-redirect-before.jpg`, `admin-funnel-owner-denied.jpg`.
- supporting: тест страницы и два теста глобального доступа PASS. Прямой live API negative заблокирован browser policy; не заявляется как выполненный.

### WB-109 — night-web-037
- date: `2026-10-09`; area: `D2 / G3`; severity: `P1`; status: `verified`
- title: После переключения бизнеса клиентская страница сохраняет данные и фильтры предыдущего бизнеса.
- steps: аналитика бизнеса 2 → переключатель бизнеса → бизнес 1 → дождаться исчезновения загрузчика; сравнить фильтр филиалов с каталогом филиалов бизнеса 1.
- expected: после смены контекста показываются только данные и фильтры выбранного бизнеса.
- actual before: заголовок/ID показывают бизнес 1, аналитика продолжает предлагать два филиала бизнеса 2; у бизнеса 1 филиалов нет.
- fix: ключ бизнес-идентичности на границе содержимого кабинета, разрешённой серверным контекстом. Смена бизнеса пересоздаёт содержимое и очищает старые данные/черновики; обновление того же бизнеса их сохраняет. Авторизация/БД не менялись.
- live verification: тот же переход 2→1 оставляет только «Все филиалы», обратный 1→2 загружает правильные два филиала.
- evidence: `business-scope-stage.json`, `analytics-business-switch-before.jpg`, `analytics-business-switch-after.jpg`.
- supporting: 3 набора / 6 тестов PASS, типы и scoped layout lint PASS.
- remaining: проверялись два законно доступных владельцу бизнеса; это не полная проверка неавторизованных границ или нескольких вкладок с общей cookie.

### WB-108 — night-web-017
- date: `2026-10-09`; area: `K3 / K5`; severity: `P2`; status: `verified`
- title: Финансовый обзор использует разные основания суммы и процентов, создавая видимость выплаты 116.2%.
- steps: владелец → финансы → день 09.10, все филиалы → отмеченная закрытая смена 301 услуг + 49 расходников → сравнить общую сумму и доли.
- expected: ясно различаются услуги, расходники и общая сумма; обе доли используют одну базу.
- actual before: оборот 301, сотруднику 181 (60.1%), бизнесу 169 (56.1%). Суммы движка правильны для общей суммы 350, но представление смешивает основания.
- fix: общий итог 350 с отдельной разбивкой 301/49, проценты 51.7%/48.3% от 350; столбец 301 назван «Услуги». Расчёты выплат, API и БД не менялись.
- live verification: тот же день/смена RU, EN, KY; пустой филиал 2 после загрузки показывает 0/0% без NaN; возврат к общему обзору. Переоткрытие/закрытие и SQL ранее подтвердили базовые суммы, не всю расчётную матрицу.
- evidence: `finance-stage.json`, `owner-finance-percent-before.jpg`, `owner-finance-basis-after.jpg`, `owner-shift-stage.json`.
- supporting: 3 набора / 15 тестов PASS, типы и scoped lint PASS.
- remaining: гарантии, часовая ставка, no-show, акции, пакетные списания и конкурентные команды не подтверждены.

### WB-107 — night-web-036
- date: `2026-10-09`; area: `J3 / K4 / K5`; severity: `P1`; status: `verified`
- title: Закрытие смены владельцем пересоздаёт сохранённые позиции клиентов.
- steps: опубликован временный рабочий день 09.10 → владелец переоткрывает отмеченную смену → Клиенты с временем 03:40 → закрывает → снова Клиенты и тот же SELECT в Supabase SQL UI.
- expected: завершение не меняет ID и время сохранённых позиций.
- actual before: время стало 06:15; ID `aea93e72` заменён на `9c8a0a7f`, created_at изменился с 21:40:54 предыдущего UTC-дня на 00:15:21 текущего. Смена и суммы 301/49/181/169 сохранены.
- fix: общая чистая нормализация/сверка сохранённого финансового снимка используется обоими путями закрытия. Владелец читает сохранённые позиции своей смены, отказывает 409 при устаревшем/несохранённом снимке до RPC; считает от сохранённых строк. Удаление/повторная вставка позиций устранены. Серверная проверка бизнеса и SQL-ограничения не менялись.
- live verification: повторное переоткрытие/закрытие сохраняет `9c8a0a7f` и created_at 00:15:21; UI остаётся 06:15. SQL и UI совпадают, смена закрыта. Более ранняя позиция была заменена уже во время воспроизведения старого кода и не подделывалась ручным восстановлением. Временные часы филиала/дня сотрудника восстановлены, понедельник 09–18 сохранён.
- evidence: `owner-shift-stage.json`, `owner-shift-open-before.jpg`, `owner-shift-item-time-before.jpg`, `owner-shift-item-time-after.jpg`, полные JSON-строки SQL UI.
- supporting: 5 наборов / 22 теста PASS и ещё 3 проверки общей сверки; 100% scoped coverage чистого helper, типы PASS, scoped lint без ошибок.
- remaining: одновременное сохранение/закрытие, пустые legacy-смены с суммой без позиций, no-show/package/promotion и расширенные часовые расчёты не подтверждены этим исправлением.

### WB-106 — night-web-035
- date: `2026-10-09`; area: `J3 / K3 / O4`; severity: `P2`; status: `verified`
- title: Список клиентов смены сохраняет русские подписи и пояснение запрета в EN/KY.
- steps: владелец → финансы сотрудника → Клиенты(1) закрытой отмеченной смены → EN → KY.
- expected: экспорт, время заполнения, ручной клиент и причина недоступности добавления переведены.
- actual before: «Экспорт», «ВРЕМЯ ЗАПОЛНЕНИЯ», «Вручную» и русский tooltip закрытой смены остаются на обоих языках.
- fix: недостающие ключи трёх словарей; существующая проверка прав возвращает ключ причины, а её представление получает переводчик. Проверки разрешений и серверные границы не менялись.
- live verification: тот же закрытый список в EN показывает Export CSV / Entered at / Walk-in / английскую причину; KY — соответствующие переводы. RU восстановлен. Экспорт загрузил CSV с одной отмеченной строкой 301/49/350 и прежним временем 03:40.
- evidence: `owner-shift-stage.json`, `owner-shift-clients-en-before.jpg`, `owner-shift-clients-en-after.jpg`, загруженный `clients_2026-10-09.csv`.
- supporting: вместе с WB-105 два набора / 10 тестов PASS; типы PASS; scoped lint 0 ошибок, четыре прежних предупреждения.
- remaining: язык содержимого CSV и остальные недоступные действия не проверены этим исправлением.

### WB-105 — night-web-034
- date: `2026-10-09`; area: `K3 / O4`; severity: `P2`; status: `verified`
- title: Заголовок финансов сотрудника у владельца содержит английскую навигацию в RU.
- steps: RU общие финансы → Детали сотрудника → заголовок.
- expected: локализованные переход к сотруднику и название кабинета.
- actual before: Back to staff / Staff Finance Workspace рядом с русскими заголовками.
- fix: два недостающих ключа staff.finance в RU/KY/EN.
- live verification: исходный RU сценарий показывает «К сотруднику» / «Финансы сотрудника»; язык переключён EN → KY → RU с правильными подписями.
- evidence: `owner-shift-language-before.jpg`, `owner-shift-clients-en-after.jpg`, `owner-shift-stage.json`, AX.
- supporting: три компонентные регрессии; входят в 10 тестов WB-106, типы PASS.

### WB-104 — night-web-033
- date: `2026-10-09`; area: `D4 / D5 / P1`; severity: `P1`; status: `verified`
- title: Ожидаемый конфликт занятого слота показан как техническая ошибка без восстановления формы.
- steps: владелец как клиент → две вкладки с 12.10 09:00 → выбрать одно время в обеих → подтвердить первую → подтвердить вторую без обновления.
- expected: второй запрос получает понятный конфликт; форма удаляет недоступное время; двойной брони нет.
- actual before: второй запрос 500; английский текст `time slot is already booked Details: [object Object]`, ошибка разработчика, старое подтверждение/слоты доступны для повторения. Двойная бронь не создана уже до исправления.
- fix: известное отклонение пересечения распознаётся на границе Supabase-адаптера и передаётся типизированной ошибкой; HTTP 409 со стабильным кодом; клиент переводит код, закрывает устаревшее подтверждение и обновляет слоты. Остальные ошибки не маскируются; SQL-писатель и ограничения не менялись.
- live verification: тот же сценарий, первая бронь `629e5c4d`; вторая вкладка получает русский отказ, диалог закрыт, список начинается с 10:00 вместо 09:00. SQL-проверка показывает ровно одну активную строку данного времени. Обе брони `3117ad85` и `629e5c4d` отменены через кабинет; SQL затем показывает ноль активных строк и 09:00 снова доступно, аудит сохранён.
- evidence: `booking-conflict-stage.json`, `booking-slot-conflict-after.jpg`, AX и SQL UI.
- supporting: 6 наборов / 22 теста PASS (API без подтверждения/уведомления при конфликте, маппинг, сохранение кода, восстановление hook и 3 языка); типы PASS, scoped 7 файлов lint PASS. Неизменённая строка auth redirect в view имеет прежнюю ошибку нового lint-правила.
- remaining: настоящий параллельный запрос разных пользователей, потеря сети после сохранения и идемпотентные повторы не подтверждены этим последовательным сценарием двух вкладок.

### WB-103 — night-web-032
- date: `2026-10-09`; area: `I4 / O4`; severity: `P1`; status: `verified`
- title: Подпись активности акции переключает активность филиала.
- steps: владелец → филиал 1 → редактировать неактивную тестовую акцию → нажать текст «Активна (отображается клиентам)».
- expected: изменяется флажок акции, филиал остаётся активным.
- actual before: флажок филиала выключается, флажок акции не меняется; два одинаковых ID `is_active` связывают обе подписи с первым полем.
- fix: уникальный React useId для флажка и подписи каждой формы акции.
- live verification: тот же клик переключает только акцию; DOM подтверждает разные ID и правильные подписи. Ошибочный черновик филиала восстановлен без сохранения; тестовая акция в итоге неактивна.
- evidence: `promotions-stage.json`, `promotion-activity-label-before.jpg`, `promotion-activity-label-after.jpg`, AX/DOM.
- supporting: 3 составных регрессии, включая клик подписи рядом с формой филиала; типы PASS, scoped lint без ошибок (прежнее предупреждение зависимостей hook).

### WB-102 — night-web-031
- date: `2026-10-09`; area: `I4 / L1`; severity: `P1`; status: `verified`
- title: Сохранённые акции не появляются в кабинете владельца.
- steps: филиал 1 → создать неактивную отмеченную акцию с N=3 → дождаться загрузки → обновить страницу.
- expected: сохранённая карточка доступна для редактирования и включения.
- actual before: «Акций пока нет» при POST/GET 200 и существующей неактивной строке в базе.
- fix: чтение `data.promotions` стандартного ответа API вместо отсутствующего верхнего поля; сервер и права не менялись.
- live verification: исходное обновление показывает N3 и карточку; редактирование N4/имени сохраняется. Активация показывает акцию клиенту; деактивация снова скрывает. Тестовая строка оставлена неактивной, без покупок и необратимого удаления.
- evidence: `promotions-stage.json`, `promotions-empty-before.jpg`, AX/SQL UI.
- supporting: 3 набора / 6 тестов PASS до дополнительной регрессии WB-103; типы PASS.

### WB-101 — night-web-030
- date: `2026-10-09`; area: `E1 / O3`; severity: `P2`; status: `verified`
- title: Неверная форма количества записей в пустом кабинете клиента.
- steps: владелец как клиент → создать отмеченную запись → отменить → открыть пустые предстоящие записи.
- expected: «У вас 0 предстоящих записей»; число не меняется при переводе.
- actual before: «У вас 0 предстоящие записи».
- fix: общий выбор формы через `Intl.PluralRules` выбранного языка; единичные формы словарей тоже подставляют фактическое число.
- live verification: исходный пустой кабинет → правильный RU текст; фактическое переключение KY и EN сохраняет ноль и соответствующий перевод; возврат RU.
- evidence: `cabinet-stage.json`, AX вкладки 7. Захват скриншота этой вкладки недоступен; не выдаётся за полученное доказательство.
- supporting: 15 граничных модульных и 6 составных тестов кабинета PASS; типы PASS, scoped lint без ошибок. Числа 21/22 проверены регрессиями, не отдельными живыми записями.

### WB-100 — night-web-029
- date: `2026-10-09`; area: `N1`; severity: `P2`; status: `verified`
- title: Совмещение владельца и клиента дублирует одинаковое Telegram-уведомление.
- steps: владелец как клиент → подтвердить бронь → отменить → открыть разрешённый KezekAuthBot.
- expected: одно сообщение каждого события в одном чате.
- actual before: по два одинаковых сообщения подтверждения и отмены записи `7b223019`; DOM подтверждает отдельные сообщения, не артефакт дерева доступности.
- fix: сначала проверяются настройки/допустимость получателя, затем устраняются повторные Telegram chat ID внутри одного события. Правила подтверждения клиентского аккаунта сохранены; WhatsApp/email не менялись.
- live verification: повторить создание и отмену `80f1b8bf` → одно подтверждение 05:37 и одна отмена 05:38; два соответствующих якоря сообщения.
- evidence: `notifications-stage.json`, `notification-confirm-after.jpg`, `notification-cancel-after.jpg`, `notification-deduplicated-after.jpg`.
- supporting: 3 набора / 17 тестов PASS, включая разные получатели, отказ по настройкам, проверку аккаунта и последующее другое событие; scoped helper coverage 100%, типы и lint PASS. Идемпотентность повторных HTTP-команд/ретраев не заявляется.

### WB-099 — night-web-028
- date: `2026-10-09`; area: `D4 / E2 / N1`; severity: `P1`; status: `verified`
- title: Публичная запись и клиентская отмена сохраняются без Telegram-уведомлений.
- steps: обычный вход владельца → записаться как клиент в бизнес 2 на 12.10 09:00 → подтверждение → отмена в кабинете → проверить разрешённый Telegram-чат.
- actual before: бронь `0a182b5c` сохранена, но новых сообщений нет; внутренний запрос к `/api/notify` теряет авторизацию и получает 401, хотя журнал говорит об успешной отправке.
- fix: серверный адаптер напрямую вызывает существующую службу уведомлений с исходным проверенным клиентом Supabase запроса. Проверка текущего пользователя и прав на конкретную бронь остаётся обязательной; публичный endpoint не ослаблен. Ошибка доставки не отменяет уже совершённую бизнес-команду и журналируется честно.
- live verification: тот же путь для `7b223019` → сообщения подтверждения 05:34 и отмены 05:35; 401 исчез. Дубли отдельно устранены в WB-100. Все три тестовые брони отменены, история сохранена.
- evidence: `notifications-stage.json`, `notification-missing-before.jpg`, `notification-confirm-after.jpg`, `notification-cancel-after.jpg`, журнал сервера.
- supporting: расширенные 7 наборов / 31 тест PASS; регрессии исходного auth-контекста, запрета чужой брони и неавторизованного клиента; scoped helper coverage 100%, типы и lint PASS.
- remaining: гостевой quick-book и старый `/booking/[id]/cancel` имеют отдельные пути, живьём ещё не проверены; email заблокирован известным неоплаченным доменом, это не исправление DNS.

### WB-098 — night-web-027
- date: `2026-10-09`; area: `M4`; severity: `P2`; status: `verified`
- title: Сводка пользователей показывает ложные нули.
- steps: суперадмин → пользователи → семь строк → поиск разрешённого аккаунта суперадмина.
- actual before: все счётчики нулевые при семи строках, включая одного суперадмина; запрос статистики `perPage=10000` отклонён ограничением 200 и замаскирован нулями.
- fix: ограниченный сбор всех страниц по 200 с дедупликацией; фильтр списка не влияет на глобальные счётчики; ошибка загрузки показывается как недоступность, не как нулевой результат.
- live verification: прежний поиск → 7/7/0/1, одна строка; сброс → семь строк и те же счётчики.
- evidence: `admin-stage.json`, `admin-users-count-before.jpg`, `admin-users-count-after.jpg`.
- supporting: тесты нескольких страниц, дедупликации, ошибок и предела; типы и scoped coverage PASS. Большая пользовательская база живьём не создавалась.

### WB-097 — night-web-026
- date: `2026-10-09`; area: `M3`; severity: `P1`; status: `verified`
- title: Сохранение категории не работает из-за неразрешённых параметров Next.js.
- steps: создать неактивную отмеченную тестовую категорию → изменить имя → сохранить.
- expected: имя сохранено, категория остаётся неактивной, остальные категории не меняются.
- actual before: `invalid input syntax for type uuid: "undefined"`; обработчик читает ID из Promise без `await`.
- fix: типизированные асинхронные route params и проверка UUID после проверки суперадмина; бизнес-логика slug и разрешения сохранены.
- live verification: тот же ввод и сохранение → имя EDITED, выключенный статус; обновление страницы подтверждает сохранение.
- evidence: `admin-stage.json`, `admin-category-edit-before.jpg`, `admin-category-edit-after.jpg`.
- supporting: 12 API-регрессий; совместный набор со статистикой 15 PASS, scoped coverage 95.06% строк / 80.85% ветвей / 66.66% функций, типы PASS. Тестовая категория оставлена неактивной, удаление не выполнялось.

### WB-096 — night-web-025
- date: `2026-10-09`; area: `M2 / O3`; severity: `P2`; status: `verified`
- title: Модерация показывает внутренние risk-флаги и непереведённые статусы.
- steps: обычный Google-вход суперадмина → заявки бизнеса; заявки доступа → «Все».
- actual before: `repeat_applicant`, `high_submission_volume`, `approved`, `cancelled` в русском интерфейсе.
- fix: общий компонент нейтральной раскрываемой истории и переведённого статуса с RU/KY/EN; неизвестные технические метки не раскрываются. Решения/права/данные заявок не менялись.
- live verification: исходные экраны, раскрытие истории, английский и кыргызский статусы после загрузки; счётчики истории сохранены.
- evidence: `admin-stage.json`, `admin-risk-flags-before.jpg`, `admin-role-status-before.jpg`, `admin-risk-flags-after.jpg`, `admin-role-status-after.jpg`.
- supporting: 5 регрессий, проверка типов PASS; scoped lint без ошибок, 2 прежних предупреждения.

### WB-095 — night-web-024
- date: `2026-10-09`; area: `B4 / D1`; severity: `P2`; status: `verified`
- title: Переход с выбранного филиала карты теряет выбор филиала.
- steps: карта → выбрать второй филиал бизнеса 2 → «Записаться» в выбранной карточке.
- expected: форма записи сохраняет выбранный филиал, не пропуская обязательные шаги.
- actual before: URL без филиала; на первом шаге оба филиала не выбраны.
- fix: единая безопасно кодируемая ссылка с параметром `branch` для списка, выбранной карточки и метки; существующее восстановление формы проверяет принадлежность филиала бизнесу.
- live verification: тот же переход → второй филиал выбран, сводка соответствует ему, «Далее» доступна.
- evidence: `public-stage.json`, `map-branch-context-before.jpg`, `map-branch-context-after.jpg`.
- supporting: 2 компонентные регрессии PASS; путь метки использует тот же помощник, но отдельно живьём не пройден.

### WB-094 — night-web-023
- date: `2026-10-09`; area: `B1 / B4`; severity: `P2`; status: `verified`
- title: Вместо названий категорий каталог и карта показывают технические slug.
- steps: главная → категории/карточки → карта → список категорий.
- actual before: `barbershop`, `zhenskaya-parikmaherskaya` вместо названий.
- fix: единое чтение названий из справочника; фильтры и URL сохраняют canonical slug. Добавлена адресная миграция `20261009050000_public_active_category_labels`: анонимное чтение только активных публичных категорий; RLS и запрет записи сохранены. Применена и зарегистрирована в основной базе разработки, повторять не нужно.
- live verification: названия на главной и карте, фильтр женской парикмахерской и сброс; после обычного выхода гостевые названия тоже доступны.
- evidence: `public-stage.json`, `home-category-before.jpg`, `home-category-after.jpg`, `map-category-before.jpg`, `map-category-after.jpg`; SQL-проверка политики и версии миграции.
- supporting: регрессии справочника/карты; ограниченное покрытие 100% строк и 91.8% ветвей, не покрытие всего проекта. Справочник имеет только `name_ru`: несуществующие переводы не выдумывались.

### WB-093 — night-web-022
- date: `2026-10-09`; area: `G2 / P1`; severity: `P2`; status: `verified`
- title: В настройках контактов вместо причины отказа показан код `validation`.
- steps: владелец бизнеса 2 → настройки → сайт `http://example.invalid` → сохранить → дождаться ответа.
- expected: понятное требование корректной HTTPS-ссылки, возможность исправить поле.
- actual before: один машинный код `validation`, сообщение сервера проигнорировано.
- fix: чтение человекочитаемого `message` из стандартного ответа; поддержан прежний вложенный формат, машинные коды не выводятся пользователю.
- live verification: тот же HTTP-адрес → «Сайт должен быть корректной HTTPS-ссылкой» → очистка адреса → успешное сохранение исходных контактов. Телефон сохранён исходный, остальные контакты пустые.
- evidence: `settings-stage.json`, `contacts-validation-before.jpg`, `contacts-validation-after.jpg`, `contacts-restored.jpg` в каталоге ночного прогона.
- supporting: 4 компонентные регрессии PASS. Остальные настройки/наследование контактов ещё не проверены полностью.

### WB-090 — night-web-019
- date: `2026-10-09`; area: `G3 / O3`; severity: `P2`; status: `verified`
- title: Аналитика не использует выбранный язык.
- steps: владелец → `/dashboard/analytics` → English; localhost/in-app Chromium/Windows, бизнес 2.
- expected: системные заголовки, фильтры и показатели на английском.
- actual before: вся аналитика по-русски при английском кабинете и футере.
- fix: единый модуль словарей аналитики RU/KY/EN, форматирование чисел/валют по локали, доступные подписи полей.
- live verification: исходный английский сценарий, затем KY/RU; заголовки, фильтры, показатели, загрузка по часам переведены. Пользовательские названия сохранены.
- evidence: `analytics-stage.json`, `analytics-language-before.jpg`, `analytics-language-after.jpg` в каталоге ночного прогона.
- supporting: языковые компонентные регрессии; это не вся языковая матрица проекта.

### WB-091 — night-web-020
- date: `2026-10-09`; area: `G3 / P1`; severity: `P1`; status: `verified`
- title: Ошибка даты аналитики удаляет фильтры и не позволяет восстановиться.
- steps: аналитика → 7 дней → начало `20260-10-02` → дождаться HTTP 400.
- actual before: только «Overview HTTP 400» и повтор того же запроса; дата и быстрый выбор исчезли.
- expected: возможность исправить период; неверные/устаревшие показатели не показаны.
- fix: фильтры остаются при ошибке; клиентская проверка формата, календарной даты, порядка и заполненности; локализованное сообщение, скрытие устаревших результатов при загрузке/ошибке.
- live verification: та же дата вызывает понятную ошибку с доступными полями; 7 дней восстанавливает данные. Обратный диапазон отклонён; 30 дней восстанавливает данные.
- evidence: `analytics-error-before.jpg`, `analytics-error-after.jpg`, `analytics-stage.json`.
- supporting: компонент/хук проверяют восстановление и неотправку некорректного запроса. Серверная проверка порядка/календаря отдельно не изменялась и живьём не проверена.

### WB-092 — night-web-021
- date: `2026-10-09`; area: `G3`; severity: `P2`; status: `verified`
- title: Быстрые периоды аналитики включают лишний день.
- steps: 9 октября выбрать «7 дней».
- actual before: 2–9 октября — восемь дат, оба конца включены в запрос агрегатов.
- expected: 3–9 октября — семь дат.
- fix: единый расчёт начальной даты `1 - days`, включая начальный период 30 дней.
- live verification: 7 → 3 октября; 30 → 10 сентября; 90 → 12 июля; окончание 9 октября, данные загружаются.
- evidence: `analytics-stage.json`, AX-снимки полей до/после.
- supporting: всего по аналитике 5 наборов / 15 тестов PASS, включая 11 новых; проверка типов PASS, локальный линт изменённой аналитики без ошибок.

### WB-085 — night-web-014
- date: `2026-10-09`; area: `H1-H2`; severity: `P0`; status: `verified`
- title: QuickDesk не позволяет создать запись: отсутствуют параметры визита, статус постоянно загружается.
- environment: localhost, in-app Chromium, Windows, владелец тестового бизнеса 2.
- steps: открыть `/dashboard/bookings` → QuickDesk → дождаться загрузки → выбрать режим клиента.
- expected: выбор филиала, даты, сотрудника, услуги, свободного времени; создание валидной записи.
- actual before: этих полей нет, филиал всегда пустой, «Создать» отключено, панель статуса никогда не заканчивает загрузку.
- fix: отдельная поверхность полей на существующих механизмах расписаний/слотов/команд; фильтрация сотрудников по рабочему филиалу на выбранную дату; фактическая доступность вместо фиктивных счётчиков.
- live verification: филиал 1, 12.10, сотрудник Адахан, услуга 60 мин → создание 09:00–10:00 → подтверждённая карточка/календарь/история → отмена. Занятые пересекающиеся интервалы исключены; после отмены снова доступны.
- evidence: `apps/web/test-results/night-2026-10-09/operations-stage.json`, `quickdesk-missing-controls-before.jpg`, `quickdesk-created-calendar.jpg`.
- supporting: 6 составных тестов QuickDesk; временный перевод проверен только модульным тестом, конкурентные запросы/hold/создание с клиентом ещё не проверены живьём.

### WB-086 — night-web-013
- date: `2026-10-09`; area: `O3 / H1`; severity: `P2`; status: `verified`
- title: Рабочее место броней смешивает английский, русский и кыргызский тексты.
- steps: открыть брони/QuickDesk/историю; переключить RU/KY/EN.
- actual before: Today/History в RU, Walk-in в KY/RU, action bar в подсказке; в EN/KY описания рабочего места и фильтров остаются русскими.
- expected: системные подписи соответствуют выбранному языку; пользовательские названия не переводятся автоматически.
- fix: общие словари трёх языков для наблюдавшихся заголовков/описаний/фильтров; исправлен ключ no-show.
- live verification: переключение трёх языков в QuickDesk и истории отменённой тестовой записи. Это не полный языковой аудит проекта.
- evidence: `operations-stage.json`, `bookings-russian-before.jpg`, `bookings-english-before.jpg`, `bookings-history-english-before.jpg`, `quickdesk-english-after.jpg`, `quickdesk-cancelled-history-after.jpg` в каталоге ночного прогона.
- supporting: 6 компонентных языковых тестов.

### WB-087 — night-web-015
- date: `2026-10-09`; area: `H2`; severity: `P1`; status: `verified`
- title: QuickDesk сохраняет запись, но не показывает результат пользователю.
- steps: выбрать валидные параметры → «Создать запись» → дождаться завершения.
- expected: видимое подтверждение или ошибка, ссылка/номер результата.
- actual before: форма молча сбрасывается; существование записи видно только после самостоятельного поиска в календаре.
- fix: подключён существующий ToastContainer к состоянию уведомлений QuickDesk.
- live verification: повтор того же создания показывает «Создана запись #dbcb3cf6»; история подтверждает сохранение. Обе тестовые записи отменены.
- evidence: `operations-stage.json`, `quickdesk-confirmation-after.jpg`.
- supporting: составные тесты успеха и ошибки; ошибка создания пока проверена только модульно.

### WB-088 — night-web-016
- date: `2026-10-09`; area: `H4`; severity: `P1`; status: `verified`
- title: После изменения поиска QuickDesk сохраняет невидимого ранее выбранного клиента.
- steps: выбрать известный аккаунт из поиска → изменить запрос на несуществующий → дождаться исчезновения результатов.
- expected: прежний выбор сброшен, создание недоступно до нового явного выбора.
- actual before: результаты/индикатор исчезают, но создание активно со старым ID клиента.
- fix: синхронная инвалидация выбора при новом запросе; проверка ID в актуальных результатах; отмена и игнорирование устаревших ответов; очистка при смене режима.
- live verification: тот же поиск/выбор разрешает создание; новый запрос сразу отключает кнопку и убирает выбор, после завершения поиска кнопка остаётся отключённой. Запись на неверного клиента не отправлялась.
- evidence: `operations-stage.json`, `quickdesk-stale-client-before.jpg`, `quickdesk-stale-client-after.jpg`.
- supporting: 4 теста состояния поиска, включая гонку запоздавших ответов.

### WB-089 — night-web-018
- date: `2026-10-09`; area: `K3`; severity: `P1`; status: `verified`
- title: Месячный фильтр финансов отправляет дневную дату и блокирует отчёт ошибкой.
- environment: localhost, in-app Chromium, Windows, владелец бизнеса 2.
- steps: открыть финансы за 09.10 → выбрать «Месяц» → дождаться ответа.
- expected: видимый октябрь и валидный запрос `YYYY-MM`; при ошибке фильтры доступны для исправления.
- actual before: поле месяца пустое, запрос отправляет `YYYY-MM-DD` и получает 400; фильтры исчезают, повторная попытка повторяет неверный запрос. Годовой путь имеет тот же неподходящий формат в коде и отдельно проверен после исправления.
- fix: один адаптер точности даты для API и полей; в состоянии сохраняется локальная дата-якорь; смена месяца/года преобразуется обратно в дату; фильтры сохраняются в состоянии ошибки.
- live verification: тот же день → месяц в пустом филиале; месяц/год всех филиалов показывают 301/181/169 и одну закрытую смену после завершения запроса. Год `20` отклонён, исправление на `2026` в сохранившемся поле восстанавливает отчёт; возврат к 09.10 также прошёл.
- evidence: `apps/web/test-results/night-2026-10-09/finance-stage.json`, `finance-month-filter-before.jpg`, `finance-month-filter-after.jpg`, `finance-error-controls-after.jpg`.
- supporting: 6 новых регрессий плюс 3 прежних теста финансового ответа; проверка типов и точечная проверка стиля пройдены.
- remaining: гонки запоздавших ответов, пустая дата, границы часового пояса и экспорт не проверены; денежные расчёты не менялись.

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
- regression evidence:
  - On `2026-07-28`, a fresh local live render of the current `main` form preview emitted the same `/logo.png` aspect-ratio warning three times across desktop load, reload, and mobile viewport.
  - The warning is unrelated to the category-select fix but means the previous global verification no longer holds for the current shared header implementation.
- status: `reopened`
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

### WB-058
- id: `WB-058`
- date: `2026-07-28`
- area: `business registration application / form controls`
- severity: `P2`
- title: Native category select is vertically misaligned with adjacent inputs
- build: current production screenshot and local `main` at `c6cc38e2`
- environment: production screenshot supplied by user; local Next.js dev server; in-app Chromium; desktop and 390 CSS-pixel viewport
- steps:
  1. Open `/business/apply` as an authenticated user.
  2. Compare the `Категория бизнеса` select with the adjacent `Город` input.
- expected:
  - The select has the same height, typography, border, spacing, focus treatment, and touch target as the form inputs.
  - Its arrow has stable spacing in light/dark themes and across supported viewport sizes.
- actual:
  - The browser-native select appearance produces a visibly shorter control and an inconsistent arrow/padding treatment.
- evidence:
  - User screenshot shows the category select shorter than the adjacent city input.
- root cause:
  - The form used a one-off native `<select>` without resetting platform appearance, while text fields use the shared `Input` control contract.
- fix:
  - Added shared `Select` UI component with `appearance-none`, a dedicated non-interactive chevron, reserved right padding, and the same label/helper/error/focus/disabled sizing contract as `Input`.
  - Migrated the business-application category control to the shared component.
- post-fix evidence:
  - Desktop live measurements: city input and category select both `327 × 46` CSS pixels; select uses `appearance: none` and `44px` right padding.
  - Mobile live measurements at 390 CSS pixels: both controls `293 × 50` with `16px` text.
  - Native option selection was exercised; choosing `Моей категории нет — предложить новую` revealed the dependent category input.
  - Browser console contained no select-related warnings or errors.
  - `BusinessApplicationForm` tests passed: 3/3; web TypeScript check passed.
- status: `fixed locally; production verification pending`
- owner: `Codex`

### WB-059
- id: `WB-059`
- date: `2026-07-28`
- area: `business registration application / localization`
- severity: `P1`
- title: Business application page remains Russian after switching the site language
- build: production `https://kezek.kg` and local `main` after `707dec4a`
- environment: production; in-app Chromium; unauthenticated desktop session
- steps:
  1. Open `/business/apply` directly.
  2. Use the shared header switcher to select `KG` or `EN`.
  3. Compare the header/footer locale with the application heading, authentication gate, benefits, and CTA.
- expected:
  - All interface copy on the page changes to the selected language.
  - The page and shared layout use one locale without untranslated keys or mixed Russian copy.
- actual:
  - Header and footer change language, but the complete business-application page remains Russian.
- evidence:
  - Production live DOM snapshot showed Kyrgyz shared navigation and footer together with Russian heading `Подключить бизнес к Kezek`, Russian authentication instructions, benefit cards, and CTA.
- root cause:
  - The server page and client form rendered hard-coded Russian strings instead of consuming the existing `LanguageProvider` dictionaries.
- fix:
  - Added a client presentation boundary for localized page and authentication-gate content while retaining authentication and database reads in the server page.
  - Migrated form labels, helper copy, validation fallbacks, success feedback, proof-link copy, consent, and submit action to the shared RU/KY/EN dictionaries.
  - Mapped stable API error codes to localized client messages; displayed errors now change language immediately and unknown server failures use a safe localized fallback.
  - Added component coverage for live locale changes in both guest and authenticated states.
- post-fix evidence:
  - Guest local live page switched completely from Russian to Kyrgyz and English, including heading, explanation, authentication gate, benefit cards, CTA, and return hint.
  - Authenticated-form live preview switched labels, category controls, proof-link copy, consent, and submit action in RU/KY/EN without remounting.
  - Kyrgyz and English locale selections survived a direct page reload; `document.documentElement.lang` followed the selected locale.
  - Direct guest route and authenticated-form preview showed no production error boundary and no horizontal document overflow at the tested 1280 CSS-pixel viewport.
  - Browser console contained no errors; the existing shared-logo aspect-ratio warning remains tracked separately as `WB-055`.
  - Safe guest-network scenario submitted the local authenticated-form preview and received the expected `401 auth_required`; English feedback appeared without navigation or data creation, then changed to Kyrgyz while all entered values remained intact.
  - Localization and form component suites passed: 5/5; final combined localization suites passed 6/6.
  - Web TypeScript validation and the Next.js `16.0.11` production build passed.
- status: `fixed locally; production verification pending`
- owner: `Codex`

### WB-060
- id: `WB-060`
- date: `2026-07-28`
- area: `shared public footer / localization`
- severity: `P2`
- title: Business entry links in the footer stay Russian in Kyrgyz and English locales
- build: local post-fix live build for `WB-059`
- environment: local Next.js dev server; in-app Chromium; unauthenticated desktop session
- steps:
  1. Open `/business/apply`.
  2. Switch the shared locale to `KG` or `EN`.
  3. Inspect the footer links for connecting or joining a business.
- expected:
  - Every footer link uses the selected locale.
- actual:
  - `Подключить бизнес` and `Заявка в бизнес` remain Russian while the rest of the footer changes locale.
- evidence:
  - Local live DOM snapshot in Kyrgyz showed the two Russian links alongside localized Kyrgyz rights, map, privacy, terms, and data-deletion links.
- root cause:
  - These two recently added footer links were hard-coded instead of using the existing footer dictionaries.
- fix:
  - Added RU/KY/EN footer dictionary entries and migrated both links to `LanguageProvider`.
  - Added component coverage for Kyrgyz and English footer states.
- post-fix evidence:
  - Local live DOM in Kyrgyz showed `Бизнести кошуу` and `Бизнеске кошулуу арызы`; all other footer links were Kyrgyz.
  - Local live DOM in English showed `Connect a business` and `Join a business`; all other footer links were English.
  - Locale persistence remained correct after direct reload.
  - Footer localization test passed together with the business-application suites: 6/6 total; web TypeScript validation and production build passed.
- status: `fixed locally; production verification pending`
- owner: `Codex`

### WB-061
- id: `WB-061`
- date: `2026-07-30`
- area: `business registration application / environment degradation`
- severity: `P1`
- title: Authenticated business application page crashes when the local service-role key is absent
- build: local `main` at `078fef8b`
- environment: `http://localhost:3000`, Next.js `16.0.11` dev server, authenticated browser session, `SUPABASE_SERVICE_ROLE_KEY` intentionally absent
- steps:
  1. Start the web app with valid public Supabase configuration but without `SUPABASE_SERVICE_ROLE_KEY`.
  2. Open `/business/apply` while authenticated.
  3. Inspect the rendered page and browser console.
- expected:
  - The public application entry renders without requiring privileged database credentials.
  - Privileged submission operations fail inside their API boundary with safe, explicit feedback if the server is not fully configured.
- actual:
  - The Server Component unconditionally creates a service-role client and throws `SUPABASE_SERVICE_ROLE_KEY is required for server-side operations`.
  - Next.js displays a full development error overlay and the root error boundary logs a second console error.
- evidence:
  - User screenshots `codex-clipboard-d5efdb08-2b74-4322-8bcc-7e7e718534a5.png` and `codex-clipboard-4d0da988-b8e4-4c87-b585-04f56c0535e8.png`.
  - Stack trace points to `BusinessApplicationPage` in `src/app/business/apply/page.tsx:22`.
- root cause:
  - A public Server Component used the service-role client merely to read active categories, coupling page rendering to an administrative secret.
- fix:
  - Removed the service-role client from the public page.
  - Active categories, the signed-in user's profile, and verified notification emails are now loaded through the cookie-aware SSR client, so RLS remains the authorization boundary.
  - Kept privileged application creation inside the server API route.
- post-fix evidence:
  - Direct local HTTP load returned `200` and contained neither the service-role exception nor a runtime-error overlay.
  - Fresh Chromium live smoke loaded `/business/apply` directly, rendered the authentication entry, and recorded zero browser console errors.
  - After updating to `main` commit `28464c58`, temporarily restoring the upstream page reproduced the same service-role crash in the running authenticated browser; reapplying this fix restored HTTP `200` and the Chromium smoke passed again.
  - Production schema inspection confirmed `categories` has RLS enabled plus an authenticated `SELECT` policy, while `profiles` and `user_notification_emails` restrict reads to `auth.uid()`.
  - A server-component regression test exercised the authenticated data-loading branch with no service-role client and verified category/profile/email prefill.
  - Business application suites passed: 6/6; TypeScript check passed.
  - Next.js `16.0.11` production build passed with `SUPABASE_SERVICE_ROLE_KEY` absent from the local environment.
- gaps:
  - Refresh the already authenticated local browser once to visually confirm the full form in the user's preserved session.
  - Production verification remains pending deployment.
- status: `fixed locally; authenticated-session visual confirmation and production verification pending`
- owner: `Codex`

### WB-062
- id: `WB-062`
- date: `2026-07-30`
- area: `business registration application / account prefill`
- severity: `P1`
- title: Business application does not prefill the phone stored in the user's account
- build: local `main` at `28464c58` plus the `WB-061` fix
- environment: `http://localhost:3000`, Next.js `16.0.11`, authenticated owner account
- steps:
  1. Sign in with an account that has a contact phone or a verified WhatsApp phone.
  2. Open `/business/apply` directly.
  3. Inspect the phone field.
- expected:
  - The contact phone from `profiles.phone` is used first.
  - If it is empty, the verified linked `profiles.whatsapp_phone` is used.
- actual:
  - The form renders an empty required phone field while the same account supplies its name and email.
- evidence:
  - User screenshot `codex-clipboard-1e540be7-a096-4032-a954-19d65bd79f14.png`.
- root cause:
  - Commit `28464c58` added and tested `selectBusinessApplicationPhone()`, but the Server Component never called it and did not select `whatsapp_phone` or `whatsapp_verified`.
- fix:
  - Extended the user-scoped profile projection with `whatsapp_phone` and `whatsapp_verified`.
  - Connected the existing canonical phone selector to the page prefill.
  - Preserved the intended priority: contact phone, Supabase Auth phone, metadata phone, then verified WhatsApp phone.
- post-fix evidence:
  - Read-only production data check confirmed the affected account has no contact phone but does have a verified WhatsApp phone, matching the missing fallback scenario without exposing the number.
  - The authenticated Server Component test now exercises the verified-WhatsApp fallback and receives the phone in `initialValues`.
  - Business application page/form/default tests passed: 11/11.
  - Web TypeScript validation passed.
  - Local `/business/apply` continued to return HTTP `200` without a runtime error.
- gaps:
  - Visual confirmation in the user's preserved authenticated browser is pending one refresh.
  - Production verification remains pending deployment.
- status: `fixed locally; authenticated visual confirmation and production verification pending`
- owner: `Codex`

### WB-063
- id: `WB-063`
- date: `2026-07-30`
- area: `business registration application / submission error handling`
- severity: `P1`
- title: Missing local service configuration is shown as a generic application failure
- build: local `main` at `28464c58` plus `WB-061`/`WB-062` fixes
- environment: `http://localhost:3000`, authenticated owner account, `SUPABASE_SERVICE_ROLE_KEY` absent
- steps:
  1. Complete `/business/apply`.
  2. Submit the form.
  3. Inspect the alert and API response.
- expected:
  - Configuration failures return a safe explicit `503` response and understandable localized feedback.
  - An existing business name returns controlled `409 business_exists`.
- actual:
  - The API returns `500 unexpected_error` before checking the business name.
  - The form shows only the generic message `Не удалось отправить заявку`.
- evidence:
  - User screenshot `codex-clipboard-68f06925-bf81-4291-bf91-5fe53e332ba8.png`.
  - Local request log: `POST /api/business-applications 500`.
  - Read-only production lookup confirms one exact business-name match, but this was not the cause of the observed `500`.
- root cause:
  - The route converted a missing service-role key into a generic internal error and the client had no configuration-specific error mapping.
- fix:
  - Missing privileged server configuration now returns safe `503 service_unavailable` instead of generic `500 unexpected_error`.
  - Added localized RU/KY/EN feedback for this code.
- post-fix evidence:
  - API regression test verifies exact `503 service_unavailable` payload without exposing configuration values.
  - Business application API/page/form/localization/default/service suites passed: 24/24.
  - Web TypeScript validation passed.
- gaps:
  - A configured service-role environment is still required for a real local application insert because RLS intentionally grants this table only to `service_role`.
  - Production post-deploy verification remains pending.
- status: `fixed locally; configured-environment and production verification pending`
- owner: `Codex`

### WB-064
- id: `WB-064`
- date: `2026-07-31`
- area: `admin business applications / terminal status UI`
- severity: `P1`
- title: Rejected business applications continue to show moderation actions
- build: local `main` at `28464c58` plus current business-application fixes
- environment: `http://localhost:3000/admin/business-applications`, authenticated super-admin
- steps:
  1. Reject a safe test business application with a reason.
  2. Reload the applications page.
  3. Click `Отклонить` again and confirm.
- expected:
  - A rejected application shows its terminal status and no approve/reject/block controls.
  - Repeated moderation cannot be initiated from the UI.
- actual:
  - `Одобрить и создать бизнес`, `Отклонить`, and `Отклонить и блокировать 30 дней` remain visible.
  - The repeated reject form opens and only fails after submission with `Заявка уже обработана или недоступна`.
- evidence:
  - User screenshots `codex-clipboard-e473d1c0-0813-4d70-b8d9-363b2ca2dbb9.png` and `codex-clipboard-f3e6480d-fd58-46a2-94e8-448678c6571b.png`.
  - Local live requests: initial rejection returned `200`; repeated rejection returned `409`.
- root cause:
  - The server page rendered moderation controls unconditionally without checking whether status was `new`/`contacted` or terminal.
- fix:
  - Added one canonical terminal-status guard for business-application moderation.
  - Approve, reject, and block actions now render only for `new` and `contacted` applications.
  - Rejected and approved cards remain visible for audit history but expose no repeated mutation controls.
- post-fix evidence:
  - Local authenticated route re-rendered successfully with HTTP `200` after the change.
  - Status-policy, API route, and business-application service suites passed `18/18`.
  - Web TypeScript validation passed.
- status: `fixed locally; authenticated visual confirmation and production verification pending`
- owner: `Codex`

### WB-065
- id: `WB-065`
- date: `2026-07-31`
- area: `business workspace selection / localization`
- severity: `P1`
- title: Business selection screen remains Russian after switching language
- build: local `main` at `28464c58` plus current UI/UX changes
- environment: `http://localhost:3000/select-business`, authenticated multi-business owner
- steps:
  1. Open `/select-business`.
  2. Switch the shared language control to `KG` or `EN`.
  3. Inspect the workspace selection heading, statuses, actions, loading, and error text.
- expected:
  - The complete selection flow follows the selected site language.
- actual:
  - `selectBusiness.*` keys were absent from all dictionaries, so fallback Russian copy remained inside the otherwise localized shell.
- evidence:
  - Source inspection found every page string relying on a Russian fallback with no matching dictionary entries.
  - Regression test reproduced the locale contract and now verifies the complete English selection screen.
- root cause:
  - The page was introduced with fallback strings but no RU/KY/EN domain dictionary.
- fix:
  - Added a dedicated `selectBusiness` RU/KY/EN dictionary and registered it in the central dictionary bundle.
  - Localized headings, current state, actions, loading, errors, count, and the switcher hint.
- post-fix evidence:
  - Workspace selection and RU/KY/EN localization tests passed `3/3`.
  - Web TypeScript validation passed.
  - Authenticated local route rendered after hot reload with HTTP `200`.
- status: `fixed locally; authenticated language-switch and production verification pending`
- owner: `Codex`

### WB-066
- id: `WB-066`
- date: `2026-07-31`
- area: `owner dashboard / quick actions hover`
- severity: `P1`
- title: Quick-action hover makes card text unreadable in the dark dashboard
- build: local `main` at `28464c58` plus current UI/UX changes
- environment: `http://localhost:3000/dashboard`, authenticated owner, dark theme
- steps:
  1. Open the owner dashboard.
  2. Hover the `Открыть «Календарь»` quick-action card.
- expected:
  - Hover reinforces the card boundary and preserves readable contrast.
- actual:
  - The card background becomes nearly white while its text remains a very light dark-theme color.
- evidence:
  - User screenshot `codex-clipboard-c2f3b4eb-810a-4b98-a104-6dd266d071ee.png`.
- root cause:
  - Quick actions mixed unconditional light Tailwind hover backgrounds with `dark:*` variants while the application theme is primarily driven by design tokens.
- fix:
  - Replaced light/dark hover pairs with theme-token text and translucent semantic accent surfaces.
  - Added consistent focus-visible rings, restrained lift, and token-based shadows.
  - Rebalanced the dashboard composition so the focus card no longer stretches into a large empty panel and KPI cards share one consistent grid.
- post-fix evidence:
  - Dashboard component regression tests passed `2/2`.
  - Web TypeScript validation and `git diff --check` passed.
  - Authenticated dashboard/API requests remained successful during hot reload.
- status: `fixed locally; authenticated hover screenshot and production verification pending`
- owner: `Codex`

### WB-067
- id: `WB-067`
- date: `2026-07-31`
- area: `owner dashboard / integration status`
- severity: `P1`
- title: Owner dashboard presents platform-wide provider health as a business integration status
- build: local `main` at `28464c58` plus current UI/UX changes
- environment: `http://localhost:3000/dashboard`, authenticated owner
- steps:
  1. Open the owner dashboard.
  2. Inspect the `Статус интеграций` card.
  3. Compare the displayed state with the server implementation and runtime log.
- expected:
  - A business-facing status explains whether that business can send each notification type.
  - Platform credential diagnostics are restricted to an operational/admin surface.
- actual:
  - The card checks global `WHATSAPP_ACCESS_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID`, and `TELEGRAM_BOT_TOKEN` values and displays the same platform-level result to every business.
  - The WhatsApp probe receives HTTP `400` from Meta because the configured object is unavailable to the configured token, while the UI only reports a generic `Ошибка API WhatsApp (400)`.
  - The probe does not verify delivery or any business-specific notification configuration.
- evidence:
  - User screenshot `codex-clipboard-b21ea8e1-dcb4-4af8-9c61-92124011452d.png`.
  - Local server log records a Meta Graph `Unsupported get request` response without exposing credentials.
  - Source trace: `DashboardHomeClient` -> `IntegrationsStatusCard` -> `/api/dashboard/integrations-status` -> `getIntegrationsStatus`.
- root cause:
  - A platform infrastructure health check was embedded in the business dashboard and labeled as a business integration status.
  - The WhatsApp check uses a direct object lookup and collapses distinct Meta errors into one generic status.
- fix:
  - Removed the platform provider health card and its API endpoint from the owner dashboard.
  - Moved live provider reachability into the existing super-admin `/admin/system-health` surface and kept it separate from delivery telemetry.
  - Changed the Meta probe to use an `Authorization: Bearer` header instead of putting the access token in the URL.
  - Added safe Meta error classification and one validated Graph API version resolver shared by health checks and message sending.
- post-fix evidence:
  - Integration service and owner dashboard regression suites passed `7/7`.
  - Next route types regenerated successfully and web TypeScript validation passed.
  - Browser live check confirmed the removed owner endpoint returns the application's safe `404` surface.
  - Browser live check confirmed the admin health endpoint is not exposed to a guest session.
- status: `fixed locally; authenticated owner and super-admin visual confirmation and production verification pending`
- owner: `Codex`

### WB-068
- id: `WB-068`
- date: `2026-07-31`
- area: `public business contacts / booking`
- severity: `P1`
- title: Applicant or owner personal phone is used as the public business contact
- build: local `main` plus current contact-layer changes
- environment: local web with connected production Supabase
- steps:
  1. Approve an authenticated business registration application.
  2. Open the created `/b/[slug]` page.
  3. Compare the displayed phone with the application contact and the business/branch settings.
- expected:
  - Public contact channels are business-owned fields configured explicitly for the business or branch.
  - Auth/profile contacts of owners and employees are never published automatically.
- actual:
  - Approval copied `business_registration_applications.phone` into `businesses.phones`, and public pages treated it as the business phone.
  - Branches could not define their own phone, WhatsApp, email, or website.
- evidence:
  - Source trace: `approveBusinessApplication()` copied the applicant phone into `businesses.phones`.
  - Local live public page displayed the migrated phone as a callable contact.
- root cause:
  - Legacy `businesses.phones` combined applicant review data and customer-facing business contact data.
- fix:
  - Added dedicated business and branch contact columns with E.164/email/HTTPS constraints.
  - Added per-field branch override with explicit fallback to business contacts.
  - Added owner settings, owner/admin branch editing, and public Call/WhatsApp/Email/website actions.
  - Business approval no longer publishes the applicant's phone.
- post-fix evidence:
  - Supabase migration applied successfully; all 9 columns exist and no branch has a null inheritance flag.
  - Contact domain, branch create/update, and application approval tests passed `22/22`.
  - Production build and TypeScript validation passed.
  - Desktop and 390x844 live browser checks rendered the callable business contact without hydration/runtime errors.
- status: `fixed locally; authenticated settings save, active-branch override, and deployed-production verification pending`
- owner: `Codex`

### WB-069
- id: `WB-069`
- date: `2026-07-31`
- area: `G1 dashboard entry and overview / localization`
- severity: `P1`
- title: Dashboard remains partially Russian after switching to English or Kyrgyz
- build: local `main` plus current dashboard UI changes
- environment: `http://localhost:3000/dashboard`, authenticated owner
- steps:
  1. Open the owner dashboard.
  2. Switch the shared language control from RU to EN.
  3. Inspect the focus card, quick-action badges and CTAs, KPI hints, and sidebar.
- expected:
  - All interface copy changes to the selected language; business and profile names remain unchanged as user data.
- actual:
  - New dashboard keys were absent from RU/KY/EN dictionaries, so `t()` returned Russian fallback text.
  - The quick-action CTA and metrics aria-label were hardcoded in Russian.
- evidence:
  - User screenshot `codex-clipboard-c76f2963-53e7-4437-91fe-9776c5838398.png`.
  - Source/dictionary comparison confirmed missing command-center, emphasis, KPI hint, sidebar, and access-application keys.
- root cause:
  - The dashboard redesign added fallback strings without adding the corresponding entries to all locale dictionaries.
- fix:
  - Added complete RU/KY/EN translations for the dashboard overview, sidebar, switcher errors, rating, and visit-package states.
  - Replaced hardcoded quick-action and accessibility labels with translated props.
  - Added a regression test that rejects Cyrillic fallback copy in the English dashboard view model.
- post-fix evidence:
  - Dashboard localization and component suites passed `4/4`.
  - TypeScript validation and `git diff --check` passed.
- status: `fixed locally; authenticated post-fix language-switch visual verification pending`
- owner: `Codex`

### WB-070
- id: `WB-070`
- date: `2026-07-31`
- area: `A3 production build / fonts`
- severity: `P2`
- title: Production build depends on live Google Fonts availability
- build: local `main` plus current changes
- environment: local `next build`
- steps:
  1. Run `pnpm --filter web build` while `fonts.googleapis.com` or `fonts.gstatic.com` is unavailable.
- expected:
  - A reproducible production build does not fail because a third-party font CDN is temporarily unreachable.
- actual:
  - `next/font` fails the build while fetching Geist and Geist Mono from Google.
- evidence:
  - Two consecutive builds failed exclusively in the Google font fetch step after TypeScript and localization tests passed.
- root cause:
  - Root layout imports remote Google fonts at build time instead of vendoring/self-hosting the required font assets.
- fix:
  - Pending: migrate Geist and Geist Mono to local font assets.
- status: `open; does not invalidate localization type/tests, but blocks current local production build`
- owner: `Codex`

### WB-071
- id: `WB-071`
- date: `2026-08-02`
- area: `B2 business page / A4 recovery states`
- severity: `P1`
- title: Temporary connectivity loss can leave a valid business page in a false not-found state
- build: local `main` plus current uncommitted changes
- environment: `http://localhost:3000/b/kezek`, Next.js dev server, in-app browser, desktop and `390x844`
- steps:
  1. Open a valid public business page.
  2. Lose connectivity while navigating or refreshing the business route.
  3. Observe the state after the route request fails and after connectivity returns.
- expected:
  - A transport failure is shown as a recoverable connectivity error, not as a definitive missing business.
  - The page retries when connectivity returns and keeps retry/catalog actions available.
- actual:
  - The route could remain on `Business not found` after a temporary offline period, with no retry action or online recovery.
  - Server-rendered not-found copy could also remain in the previous language after switching locale.
- evidence:
  - User screenshot `codex-clipboard-26b95d1f-0477-4e76-bf37-2e30261159a0.png`.
  - Post-fix live forced transport failure rendered `Could not load the business`, `Try again`, and `Back to catalog` instead of a false 404.
  - Live RU -> EN switch updated the entire recovery surface; retry kept the page usable during the continuing failure.
  - Mobile `390x844` geometry: card width `358px`, document width and scroll width `390px` (no horizontal overflow).
- root cause:
  - The not-found surface was a terminal Server Component result and had no browser connectivity awareness, retry action, or `online` event recovery.
- fix:
  - Added one shared client recovery state for definitive not-found and transient unavailable outcomes.
  - Offline state now overrides false not-found copy; returning online automatically refreshes the route.
  - Both outcomes expose retry and catalog actions and use the live client locale.
- post-fix evidence:
  - `BusinessPageState` regression suite passed `2/2` and TypeScript validation passed.
  - Browser live check covered forced fetch failure, retry, language switching, desktop layout, and mobile layout.
- status: `fixed locally; online recovery against a valid Supabase response and deployed-production verification pending`
- owner: `Codex`

### WB-072
- id: `WB-072`
- date: `2026-08-02`
- area: `G1 dashboard header / workspace navigation`
- severity: `P1`
- title: Header dropdown mixes cabinet and business switching and does not identify the current cabinet
- build: local `main` plus current uncommitted dashboard changes
- environment: `http://localhost:3000/dashboard`, authenticated multi-business owner, desktop
- steps:
  1. Open the owner dashboard with access to more than one business.
  2. Open the header dropdown labelled `Owner / manager`.
  3. Compare its contents with the business switcher in the dashboard sidebar.
- expected:
  - The header control identifies and switches the current cabinet/role context.
  - Business workspace selection has one clear owner and is not duplicated inside an unrelated role menu.
  - The active cabinet is visibly identified and all copy follows the selected locale.
- actual:
  - The control displayed the highest available role instead of the currently open cabinet.
  - It mixed business rows, a second business-selection link, and cabinet destinations in one menu.
  - On the dashboard this duplicated the dedicated sidebar business switcher; the English menu also contained Russian fallback copy.
- evidence:
  - User screenshot `codex-clipboard-b4fa9a16-2e49-4294-998f-c7caa875e287.png`.
  - Source inspection of `RoleAndBusinessSwitcher` confirmed inline POST business switching and role links shared one menu.
- root cause:
  - A single header component owned two independent navigation domains and derived its trigger label from role priority rather than the current pathname.
- fix:
  - Restricted the header dropdown to cabinet switching only; business switching remains in the dedicated dashboard workspace selector and `/select-business` flow.
  - Derived the trigger and active marker from the current route.
  - Added menu semantics, Escape handling, focus states, and removed obsolete manager wording from RU/KY/EN labels.
- post-fix evidence:
  - Focused component suite passed `2/2`; TypeScript validation passed.
  - Regression tests verify no business rows appear, the dashboard cabinet is active, Escape closes the menu, and `/cabinet/*` displays `My bookings` instead of the highest available role.
- status: `fixed locally; authenticated visual post-fix verification pending`
- owner: `Codex`

### WB-073
- id: `WB-073`
- date: `2026-08-02`
- area: `G1 dashboard workspace switching`
- severity: `P1`
- title: Business switching has no clear pending state or protection against repeated actions
- build: local `main` plus current uncommitted dashboard changes
- environment: `http://localhost:3000/dashboard`, authenticated multi-business owner, desktop
- steps:
  1. Open the business selector in the dashboard sidebar.
  2. Select another business.
  3. Observe the interface while the current-business request and dashboard refresh are in progress.
- expected:
  - The selected target and switching progress are immediately visible.
  - Repeated business selections are blocked until the server-confirmed workspace is rendered.
  - A failed or stalled switch returns to a usable selector with safe feedback.
- actual:
  - Switching caused only subtle changes in the selector and page content, so it was unclear whether the action had started or completed.
  - The selector stayed interactive while the request was pending.
- evidence:
  - User screenshot `codex-clipboard-8a8b7d1b-6944-4acd-8f7e-17af138c0175.png`.
  - Component inspection confirmed there was no pending state spanning the POST request and subsequent Server Component refresh.
- root cause:
  - The switcher treated the API response as the end of the interaction even though the visible workspace changes only after `router.refresh()` returns updated server props.
- fix:
  - Added one explicit switching state that starts before the request and ends only when `serverCurrentBizId` confirms the selected business.
  - Added a localized blocking overlay and inline spinners with the target business name.
  - Disabled repeated selections while pending and added a 15-second timeout with recoverable localized feedback.
  - Kept the selector usable after request failure without exposing server details.
- post-fix evidence:
  - Focused component suite passed `2/2` for delayed success/server confirmation and API failure recovery.
  - TypeScript validation and `git diff --check` passed.
- status: `fixed locally; authenticated visual post-fix verification pending`
- owner: `Codex`

### WB-074
- id: `WB-074`
- date: `2026-08-02`
- area: `I1 branch management / business contacts`
- severity: `P1`
- title: Enabled contact inheritance does not show which business values a new branch will publish
- build: local `main` plus current uncommitted branch-contact changes
- environment: `http://localhost:3000/dashboard/branches/new`, authenticated owner, desktop
- steps:
  1. Configure public contacts for a business.
  2. Open the new-branch form with `Use business contacts` enabled.
  3. Inspect the empty branch contact inputs.
- expected:
  - The form immediately shows the effective inherited business contacts.
  - Inherited values remain linked to business settings unless the owner explicitly overrides a field.
  - Disabling inheritance reveals only branch-owned values.
- actual:
  - Empty inputs made the effective public contacts invisible even though inheritance was enabled.
  - The owner could not confirm which phone, WhatsApp, email, or website clients would see.
- evidence:
  - User screenshot `codex-clipboard-8f34cdc7-c54f-43de-854b-3231fc8b2028.png`.
  - Source inspection confirmed the form received only branch fields and did not receive current business contacts.
- root cause:
  - Contact fallback existed only in the public contact resolver; the branch editor had no presentation model for effective inherited values.
- fix:
  - Extended the already-authorized manager business context with the four public business contact fields.
  - Passed those fields to the new-branch form and derived each displayed value from `branch override -> business fallback`.
  - Kept inherited values out of the branch payload so later business-contact edits continue to propagate.
  - Added localized source/missing-value guidance for RU, EN, and KY.
- post-fix evidence:
  - Component regression verifies inherited display, checkbox behavior, and that inherited values are not copied into the create payload.
  - Branch form, business switcher, and business-context tests passed; TypeScript validation passed.
- status: `fixed locally; authenticated visual post-fix verification pending`
- owner: `Codex`

### WB-075
- id: `WB-075`
- date: `2026-08-09`
- area: `C6 session restoration / A2 service connectivity`
- severity: `P1`
- title: Auth status updater can create repeated Server Component refreshes and multiply transient Supabase errors
- build: local `main` plus current uncommitted changes
- environment: `http://localhost:3000`, Next.js 16 development server, authenticated Chrome and clean in-app browser
- steps:
  1. Open the local application with an existing Supabase session.
  2. Allow `AuthStatusUpdater` to mount or experience a short network interruption.
  3. Inspect the Next.js development issue overlay and Supabase requests.
- expected:
  - The initial session establishes a baseline without refreshing the same Server Components repeatedly.
  - A token refresh for the same identity does not force a full RSC refresh.
  - One transient auth failure produces one recoverable error, not a growing issue stack.
- actual:
  - Every mount compared the existing user with a fresh `null` ref and called `router.refresh()`.
  - A two-second polling interval and auth events caused additional checks and remounts.
  - A short failed Auth fetch produced multiple development-overlay issues, each accompanied by Turbopack's invalid source-map diagnostic.
- evidence:
  - User screenshot `codex-clipboard-1ecdd33e-d10e-4555-b6ea-5102f0c24a19.png` showed `10 Issues` and the Supabase Auth fetch stack through `AppShellHeader`.
  - Supabase Auth/API logs at the same time showed successful `/user`, RPC, profile, and REST responses, excluding a database outage or persistent CORS failure.
  - Source inspection found an initial `getSession()` refresh, an auth subscription refresh, and a two-second session polling interval in the global root layout updater.
- root cause:
  - The client updater did not treat `INITIAL_SESSION` as a baseline and reset its identity ref after every RSC-triggered remount.
  - The local server was also initially started inside a network-restricted process, making transient server fetch failures deterministic in that run.
- fix:
  - Replaced session polling with one Supabase auth subscription.
  - `INITIAL_SESSION`, duplicate `SIGNED_IN`, and same-user `TOKEN_REFRESHED` events no longer refresh Server Components.
  - Real sign-in, sign-out, identity change, and profile update still schedule one debounced refresh.
  - Cleanup now cancels pending refresh work and unsubscribes reliably.
  - Restarted the local Next.js server with outbound access to the configured Supabase environment.
- post-fix evidence:
  - Auth updater regression suite passed `3/3`; TypeScript validation passed.
  - Fresh live browser load rendered both real businesses and their contacts with no console warnings or errors.
  - Local `/` returned `HTTP 200`; Supabase-backed marketplace data loaded instead of the service-unavailable state.
- status: `fixed locally; authenticated Chrome session refresh confirmation pending`
- owner: `Codex`

### WB-076
- id: `WB-076`
- date: `2026-08-09`
- area: `I1 branch management / localization`
- severity: `P1`
- title: New-branch page remains partially Russian after switching to English or Kyrgyz
- build: local `main` plus current uncommitted changes
- environment: `http://localhost:3000/dashboard/branches/new`, authenticated multi-business owner, desktop
- steps:
  1. Open the new-branch page in Russian.
  2. Switch the shared language selector to English.
  3. Inspect the page heading, address helper, contact section, map guidance, and contact field labels.
- expected:
  - Every Kezek-owned label and recovery message follows the selected locale.
  - Server-rendered page headings and client form content change consistently.
- actual:
  - Address instructions changed to English, while the page heading, manual-address helper, contact title/description, inheritance control, and contact labels stayed Russian.
  - Kezek's map footer guidance and map failure state were also hardcoded in Russian.
- evidence:
  - User screenshot `codex-clipboard-11238a37-5bc5-4132-98cf-f90b79cc3d73.png`.
  - Source audit found untranslated literals in the Server Component, branch form, and map component; the branch dictionaries lacked the corresponding keys.
- root cause:
  - The branch form migration to shared i18n covered the address and submit fields but left the newer contact/inheritance UI as literals.
  - The Server Component used fixed Russian text, and the map error UI was injected as Russian HTML.
- fix:
  - Added one complete, matching set of branch form/new-page/map keys to RU, EN, and KY dictionaries.
  - Moved contact labels, descriptions, inheritance copy, page title, branch-limit feedback, and manual-address helper to `t()`.
  - Made the Server Component resolve its translator from the current locale cookie.
  - Replaced imperative map-error HTML with localized React UI and localized the map search placeholder/footer guidance.
- post-fix evidence:
  - Branch localization, contact form, and map recovery suites passed `4/4`.
  - Dictionary parity test confirms RU, EN, and KY expose the same branch keys.
  - TypeScript validation passed.
- status: `fixed locally; authenticated visual RU -> EN -> KY confirmation pending`
- owner: `Codex`

### WB-077
- id: `WB-077`
- date: `2026-08-09`
- area: `A4 error boundaries / localization`
- severity: `P2`
- title: Service-unavailable recovery keeps the reload action in Russian under English locale
- build: local `main` plus current uncommitted changes
- environment: `http://127.0.0.1:3000/dashboard/branches/new`, guest direct load, English locale, in-app browser
- steps:
  1. Set the application locale to English.
  2. Direct-load an authenticated dashboard route without a usable session/service connection.
  3. Inspect the localized recovery actions.
- expected:
  - The heading, description, links, and imperative reload button all use English.
- actual:
  - The recovery surface was English except for the button `Обновить страницу`.
- evidence:
  - Live DOM snapshot showed `Service connection unavailable`, `Try again`, `Back to catalog`, and the Russian reload button in the same recovery UI.
- root cause:
  - `ErrorDisplay` requested `error.action.reload`, but the shared RU/EN/KY dictionaries did not define that key, so the Russian fallback leaked into every locale.
- fix:
  - Added `error.action.reload` to the English, Russian, and Kyrgyz shared dictionaries.
- post-fix evidence:
  - Focused ErrorDisplay localization test passed and resolves the English button as `Reload page`.
  - Combined localization suites passed `5/5`; TypeScript validation passed.
  - Post-fix direct reload in the in-app browser rendered `Reload page` alongside the English recovery copy.
- status: `fixed and live-verified locally`
- owner: `Codex`

### WB-078
- id: `WB-078`
- date: `2026-08-09`
- area: `I1 branch management / A4 error surfaces`
- severity: `P1`
- title: Branch edit page fails on ambiguous businesses embed and exposes the PostgREST error
- build: local `main` plus current uncommitted changes
- environment: `http://localhost:3000/dashboard/branches/fe1dde50-c04a-4b48-b215-bde72aa60625`, authenticated owner, desktop
- steps:
  1. Open the branch list for the active business.
  2. Open the existing branch directly.
  3. Observe the branch edit route.
- expected:
  - The branch edit form opens for a branch belonging to the active business.
  - A recoverable failure shows safe localized guidance without backend details.
- actual:
  - The branch request returned HTTP `300` / PostgREST ambiguous-embedding failure.
  - The page printed `Could not embed because more than one relationship was found for 'branches' and 'businesses'` directly in the UI.
- evidence:
  - User screenshot `codex-clipboard-ab081a8b-d989-4eb8-a668-8361a1ba3579.png`.
  - Supabase API logs recorded the failing `branches?...businesses!inner(...)` request with status `300`.
- root cause:
  - The edit page embedded `businesses` through an inferred PostgREST relationship instead of scoping the branch to the already resolved active business.
  - `BranchErrorDisplay` rendered the raw database error message.
- fix:
  - Removed the embedded relationship from the branch query.
  - Scoped the branch lookup by both branch ID and the active `biz_id`.
  - Loaded the current business identity through a separate unambiguous query.
  - Added a localized recovery surface that logs internal diagnostics server-side but never prints database details to the user.
- post-fix evidence:
  - Focused page test confirms the branch query contains no embedded `businesses`, applies `id + biz_id`, and loads business identity separately.
  - Dictionary parity and TypeScript validation passed.
  - Live Supabase API logs recorded the corrected branch request with status `200` three times after HMR; the prior request was `300`.
- status: `fixed locally; live network verified, final visual confirmation pending`
- owner: `Codex`

### WB-079
- id: `WB-079`
- date: `2026-08-09`
- area: `I1 branch management / map resilience`
- severity: `P1`
- title: Recoverable Yandex Maps initialization failure opens the Next.js error overlay and cannot retry
- build: local `main` plus current uncommitted changes
- environment: `http://localhost:3000/dashboard/branches/fe1dde50-c04a-4b48-b215-bde72aa60625`, authenticated owner, desktop, Next.js dev
- steps:
  1. Open the existing branch edit route after a prior network interruption or map script failure.
  2. Wait for the map picker to initialize.
- expected:
  - A transient map failure keeps the form usable, shows localized fallback guidance, and permits retry.
  - Recoverable provider failures do not trigger the framework error overlay.
- actual:
  - `BranchMapPicker` logged initialization through `console.error`, which opened the Next.js dev overlay.
  - The Yandex loader cached its rejected Promise, so later attempts reused the same failure until the module/page was fully restarted.
- evidence:
  - User screenshot `codex-clipboard-4d4de514-e6fa-4a2a-9134-aaf867df5119.png`.
- root cause:
  - `loadYandexMaps()` never cleared `loadPromise` after script rejection.
  - The map picker classified provider/network degradation as an application error instead of a recoverable warning.
- fix:
  - Reset the cached loader and remove the failed script after rejection so a later call starts a clean request.
  - Added a localized `Retry map loading` action to the fallback surface.
  - Changed recoverable map initialization, geocoding, and interaction diagnostics from error to warning logging.
- post-fix evidence:
  - Loader recovery, retry UI, and dictionary parity suites passed `3/3`; TypeScript validation passed.
  - Live browser direct-load of `/map` rendered the real Yandex map and branch marker with no map error in console.
- status: `fixed locally; shared loader live-verified, authenticated branch visual confirmation pending`
- owner: `Codex`

### WB-080
- id: `WB-080`
- date: `2026-08-09`
- area: `I1 branch management / environment wiring`
- severity: `P1`
- title: Branch edit route does not pass Yandex Maps configuration or business contact inheritance data
- build: local `main` plus current uncommitted changes
- environment: `http://localhost:3000/dashboard/branches/fe1dde50-c04a-4b48-b215-bde72aa60625`, authenticated owner, desktop
- steps:
  1. Open the existing branch edit page after WB-079 fallback handling is active.
  2. Inspect the map panel.
- expected:
  - The edit route initializes Yandex Maps with the same server-provided public key as the create and public-map routes.
  - Empty branch contact fields can inherit the active business contacts.
- actual:
  - The map displayed its safe fallback because `EditBranchPageClient` never received or forwarded `yandexMapsApiKey`.
  - The same route also omitted business contact values when rendering the shared branch form.
- evidence:
  - User screenshot `codex-clipboard-6cad5cb8-bfd1-479e-a0da-d89f2faafc6e.png`.
  - Source comparison showed `/map` and `/dashboard/branches/new` pass the server environment key while `/dashboard/branches/[id]` did not.
- root cause:
  - The shared `BranchForm` contract had evolved, but the edit route integration was not updated with its environment and inheritance props.
- fix:
  - Extended the edit-page business query with public business contact fields.
  - Passed the server-side `NEXT_PUBLIC_YANDEX_MAPS_API_KEY` and business contacts through `EditBranchPageClient` into the shared form.
- post-fix evidence:
  - Focused edit-page test confirms the map key and all four business contact fields are passed with the business-scoped branch data.
  - Combined branch map/edit/loader suites passed `3/3`; TypeScript validation passed.
- status: `fixed locally; authenticated visual confirmation pending`
- Follow-up14OctG005: actual owner new form clear -> live input.value empty -> type30 -> live value30; isolated hidden creation persisted30. Targeted authenticated functional confirmation complete; screenshot unavailable, no visual/mobile PASS. Historical fix is not a new14Octfix.
- owner: `Codex`

### WB-083 — ночной прогон 2026-10-09, night-web-011

- area: `J2 shift close / K4 audit preservation`
- severity: `P1`
- status: `fixed and live verified — staff close only`
- environment: Windows, in-app Chromium, localhost:3000, main 7f5c8ae plus night changes; authorized staff profile.
- steps: save a marked manual client (301 service + 49 consumables), inspect fill time; close the shift; reopen and close it again. Read item ID/created_at via authorized Supabase SQL UI before and after.
- expected: closing finalizes the saved shift without replacing client records or resetting their original creation time.
- actual before fix: fill time changed 03:30 → 03:40; the same shift's item ID changed b048d612-150e-4678-8345-f3f941c327ac → aea93e72-25a2-4e65-a85b-7dbeecf9c7fc. SQL confirmed creation time reset.
- root cause: staff close service deleted every saved position and reinserted the submitted snapshot after committing the close RPC.
- fix: finalize the persisted, shift-scoped ledger; reject stale/unsaved financial snapshots before closing; remove post-close item replacement. No DB migration or permission change.
- live retest: reopened and closed the same shift at 03:42; item ID aea93e72-25a2-4e65-a85b-7dbeecf9c7fc and created_at 2026-10-08T21:40:54.460942Z remained unchanged. Clients stayed visible read-only; amounts 301/49 and shares 181/169 unchanged.
- evidence: apps/web/test-results/night-2026-10-09/staff-stage.json; shift-close-preserved-time.jpg (ignored local evidence).
- supporting checks: 8 service regressions and web typecheck passed; scoped service lint has no errors (four existing any warnings).
- gaps: owner's separate close path, concurrent item save versus close, package/no-show cases and aggregate consistency after repeated reopen are not yet verified. This entry does not certify all finance functionality.

### WB-084 — ночной прогон 2026-10-09, night-web-012

- area: `K3 owner finance / K5 staff-owner consistency`
- severity: `P1`
- status: `fixed and live verified — simple closed shift`
- environment: Windows, in-app Chromium, localhost:3000, main 7f5c8ae plus night changes; authorized owner of Test business 2.
- steps: close the marked staff shift with 301 service / 49 consumables; sign in as owner, select that business, open /dashboard/finance, wait, explicitly refresh and wait again.
- expected: one closed shift and matching staff/business amounts, branch and period controls.
- actual before fix: persistent “Пока нет данных” after successful load and refresh; no filters or saved shift totals.
- root cause: API returns `{ok:true,data:{staffStats,totalStats,branches}}`; the client hook read these fields at the response root and discarded them.
- fix: read the standard nested data envelope; reject failed HTTP or missing payload instead of showing a false empty ledger.
- live retest: the same page displays 1 closed shift, turnover 301, staff 181, business 169, matching staff summary and employee row; date and both branch options restored.
- evidence: owner-finance-empty-before.jpg / owner-finance-after.jpg and owner-stage.json under apps/web/test-results/night-2026-10-09 (ignored local evidence).
- supporting checks: three hook regressions and web typecheck passed.
- gaps: expanded filter periods, exports, package/promo finance and percentage presentation still need live verification.

### WB-081
- id: `WB-081`
- date: `2026-08-13`
- area: `G2 dashboard navigation / O responsive UI`
- severity: `P1`
- title: Dashboard workspace drawer obscures tablet content and competes with the global mobile menu
- build: local `main` plus current uncommitted changes
- environment: `http://localhost:3000/dashboard/branches/fe1dde50-c04a-4b48-b215-bde72aa60625`, authenticated owner, responsive viewport `768x802`
- steps:
  1. Open an authenticated dashboard route at tablet width.
  2. Open workspace navigation.
  3. Inspect the relationship between the sticky global header, workspace drawer, and page content.
- expected:
  - Tablet navigation occupies a predictable layout column and never covers the working area.
  - Phone navigation remains reachable without competing floating hamburger controls.
  - Long navigation lists remain scrollable and respect safe-area insets.
- actual:
  - The phone-style left drawer was reused up to the desktop `lg` breakpoint.
  - At `768px` it opened below/behind the higher-z-index global header and covered a large part of the branch form and map.
  - A separate global hamburger remained visible, making the two menu responsibilities unclear.
- evidence:
  - User screenshot `codex-clipboard-cb521204-c878-4a04-bd34-dad1d6708e00.png` at `768x802`.
- root cause:
  - One fixed off-canvas layout served both phones and tablets.
  - The workspace trigger used the same hamburger pattern as the global account/language menu.
  - Dashboard and staff content retained spacing reserved for the old floating trigger.
- fix:
  - Added a labeled, persistent tablet navigation rail that participates in page layout instead of overlaying content.
  - Replaced the phone drawer with a bottom navigation bar for primary destinations and a safe-area-aware `More` bottom sheet for the complete workspace navigation and business selector.
  - Added backdrop dismissal, Escape handling, background scroll lock, active secondary-section indication, reduced-motion support, and localized `More` labels in RU/EN/KY.
  - Applied the shared responsive navigation architecture to both owner and staff workspaces and removed the obsolete top spacing.
- post-fix evidence:
  - Workspace navigation tests passed `4/4`, including mobile opening, Escape dismissal, scroll locking, and desktop collapse persistence.
  - Web TypeScript validation and `git diff --check` passed.
- status: `fixed locally; authenticated tablet/mobile visual confirmation pending`
- owner: `Codex`

### WB-082
- id: `WB-082`
- date: `2026-08-13`
- area: `I2 service management / O form UX`
- severity: `P1`
- title: Clearing service duration forces zero and turns a new 30-minute value into 030
- build: local `main` plus current uncommitted changes
- environment: `http://localhost:3000/dashboard/services/new`, authenticated owner, desktop viewport
- steps:
  1. Open the new-service form.
  2. Clear the default duration.
  3. Type `30`.
- expected:
  - The duration field can remain empty while the user edits it.
  - Typing `30` displays and submits exactly `30` minutes.
- actual:
  - Clearing the field immediately changed its controlled value to `0`.
  - Typing `30` after that zero displayed `030`, making the intended value unclear.
- evidence:
  - User screenshot `codex-clipboard-be040e9d-4971-4047-9593-4f7aceb72c73.png`.
- root cause:
  - The input handler used `Number(value) || 0` on every keystroke, so the valid editing state `''` was coerced to zero.
- fix:
  - Store duration as an input draft string while editing, allow a real empty state, strip leading zeroes, and convert to a number only after validation for the API payload.
  - Added integer input metadata (`min=1`, `step=1`, numeric input mode).
- post-fix evidence:
  - Focused ServiceForm tests passed `3/3`: clearing retains an empty field, `030` normalizes to `30`, and the API payload contains numeric `30`.
  - Web TypeScript validation passed.
- status: `fixed locally; authenticated visual confirmation pending`
- owner: `Codex`
