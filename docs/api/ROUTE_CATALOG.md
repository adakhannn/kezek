# Полный каталог HTTP-маршрутов

Статус: автоматически построенная карта исходников. Генератор читает TypeScript AST и локальные re-export; приложение и handlers не выполняются.

В текущем дереве: **182 route-файлов, 213 явных METHOD/path**. Автоматические HEAD/OPTIONS framework не добавляются; middleware, rewrites и доступность deployment этой картой не проверяются.

Для каждой пары есть один api-contract marker в тематическом справочнике. Это контроль полноты навигации; факты контракта сверены чтением исходников, runtime NOT_RUN.

Контрольная сумма 514 исходных файлов (routes и явно связанные из справочников TS/JS/SQL/config): `d8063af745b64e88e20c662cfc3d4fc429f83860a235563d77bd8a0c419efba9`. Изменение этих файлов требует повторной сверки затронутого описания перед обновлением каталога. Транзитивные зависимости без прямой ссылки этим fingerprint не охвачены.

[Руководство API](../../API_DOCUMENTATION.md) объясняет границы контрактов. Колонка «Делегирование» содержит вызванные из route функции с префиксом run и re-export; это указатель чтения, не полный граф вызовов или доказательство авторизации.

Обновление из корня: `node scripts/generate-api-catalog.mjs --write`. Проверка без записи: `node scripts/generate-api-catalog.mjs --check`. Нужен установленный TypeScript из корневых devDependencies; сеть не используется.

## /admin

| Путь | Явные методы | Исходник | Делегирование | Контракт |
| --- | --- | --- | --- | --- |
| `/admin/api/analytics/conversion-funnel` | GET | [route](../../apps/web/src/app/admin/api/analytics/conversion-funnel/route.ts) | Внутри route; читать исходник | [справочник](ADMIN_API.md) |
| `/admin/api/analytics/load` | GET | [route](../../apps/web/src/app/admin/api/analytics/load/route.ts) | Внутри route; читать исходник | [справочник](ADMIN_API.md) |
| `/admin/api/analytics/overview` | GET | [route](../../apps/web/src/app/admin/api/analytics/overview/route.ts) | Внутри route; читать исходник | [справочник](ADMIN_API.md) |
| `/admin/api/analytics/promotions` | GET | [route](../../apps/web/src/app/admin/api/analytics/promotions/route.ts) | Внутри route; читать исходник | [справочник](ADMIN_API.md) |
| `/admin/api/analytics/track` | POST | [route](../../apps/web/src/app/admin/api/analytics/track/route.ts) | Внутри route; читать исходник | [справочник](ADMIN_API.md) |
| `/admin/api/business-applications/[id]/status` | POST | [route](../../apps/web/src/app/admin/api/business-applications/[id]/status/route.ts) | Внутри route; читать исходник | [справочник](ADMIN_API.md) |
| `/admin/api/businesses/[id]/branch-limit` | POST | [route](../../apps/web/src/app/admin/api/businesses/[id]/branch-limit/route.ts) | Внутри route; читать исходник | [справочник](ADMIN_API.md) |
| `/admin/api/businesses/[id]/branches/[branchId]/delete` | POST, DELETE | [route](../../apps/web/src/app/admin/api/businesses/[id]/branches/[branchId]/delete/route.ts) | Внутри route; читать исходник | [справочник](ADMIN_API.md) |
| `/admin/api/businesses/[id]/branches/[branchId]/schedule` | GET, POST | [route](../../apps/web/src/app/admin/api/businesses/[id]/branches/[branchId]/schedule/route.ts) | Внутри route; читать исходник | [справочник](ADMIN_API.md) |
| `/admin/api/businesses/[id]/branches/[branchId]/update` | POST, PUT, PATCH, OPTIONS | [route](../../apps/web/src/app/admin/api/businesses/[id]/branches/[branchId]/update/route.ts) | Внутри route; читать исходник | [справочник](ADMIN_API.md) |
| `/admin/api/businesses/[id]/branches/create` | POST, OPTIONS | [route](../../apps/web/src/app/admin/api/businesses/[id]/branches/create/route.ts) | Внутри route; читать исходник | [справочник](ADMIN_API.md) |
| `/admin/api/businesses/[id]/delete` | POST | [route](../../apps/web/src/app/admin/api/businesses/[id]/delete/route.ts) | Внутри route; читать исходник | [справочник](ADMIN_API.md) |
| `/admin/api/businesses/[id]/members/add` | POST | [route](../../apps/web/src/app/admin/api/businesses/[id]/members/add/route.ts) | Внутри route; читать исходник | [справочник](ADMIN_API.md) |
| `/admin/api/businesses/[id]/members/demote` | POST | [route](../../apps/web/src/app/admin/api/businesses/[id]/members/demote/route.ts) | Внутри route; читать исходник | [справочник](ADMIN_API.md) |
| `/admin/api/businesses/[id]/members/grant` | POST | [route](../../apps/web/src/app/admin/api/businesses/[id]/members/grant/route.ts) | Внутри route; читать исходник | [справочник](ADMIN_API.md) |
| `/admin/api/businesses/[id]/members/invite` | POST | [route](../../apps/web/src/app/admin/api/businesses/[id]/members/invite/route.ts) | Внутри route; читать исходник | [справочник](ADMIN_API.md) |
| `/admin/api/businesses/[id]/members/list` | GET | [route](../../apps/web/src/app/admin/api/businesses/[id]/members/list/route.ts) | Внутри route; читать исходник | [справочник](ADMIN_API.md) |
| `/admin/api/businesses/[id]/members/revoke` | POST | [route](../../apps/web/src/app/admin/api/businesses/[id]/members/revoke/route.ts) | Внутри route; читать исходник | [справочник](ADMIN_API.md) |
| `/admin/api/businesses/[id]/owner/list` | GET | [route](../../apps/web/src/app/admin/api/businesses/[id]/owner/list/route.ts) | Внутри route; читать исходник | [справочник](ADMIN_API.md) |
| `/admin/api/businesses/[id]/owner/save` | POST, PUT | [route](../../apps/web/src/app/admin/api/businesses/[id]/owner/save/route.ts) | Внутри route; читать исходник | [справочник](ADMIN_API.md) |
| `/admin/api/businesses/[id]/owner/set` | POST | [route](../../apps/web/src/app/admin/api/businesses/[id]/owner/set/route.ts) | Внутри route; читать исходник | [справочник](ADMIN_API.md) |
| `/admin/api/businesses/[id]/owner/update` | POST | [route](../../apps/web/src/app/admin/api/businesses/[id]/owner/update/route.ts) | Внутри route; читать исходник | [справочник](ADMIN_API.md) |
| `/admin/api/businesses/[id]/owner/upsert` | POST | [route](../../apps/web/src/app/admin/api/businesses/[id]/owner/upsert/route.ts) | Внутри route; читать исходник | [справочник](ADMIN_API.md) |
| `/admin/api/businesses/[id]/update` | PATCH | [route](../../apps/web/src/app/admin/api/businesses/[id]/update/route.ts) | Внутри route; читать исходник | [справочник](ADMIN_API.md) |
| `/admin/api/businesses/create` | POST | [route](../../apps/web/src/app/admin/api/businesses/create/route.ts) | Внутри route; читать исходник | [справочник](ADMIN_API.md) |
| `/admin/api/categories/[id]/delete` | POST, DELETE | [route](../../apps/web/src/app/admin/api/categories/[id]/delete/route.ts) | Внутри route; читать исходник | [справочник](ADMIN_API.md) |
| `/admin/api/categories/[id]/update` | POST | [route](../../apps/web/src/app/admin/api/categories/[id]/update/route.ts) | Внутри route; читать исходник | [справочник](ADMIN_API.md) |
| `/admin/api/categories/create` | POST | [route](../../apps/web/src/app/admin/api/categories/create/route.ts) | Внутри route; читать исходник | [справочник](ADMIN_API.md) |
| `/admin/api/categories/existing` | GET | [route](../../apps/web/src/app/admin/api/categories/existing/route.ts) | Внутри route; читать исходник | [справочник](ADMIN_API.md) |
| `/admin/api/categories/list` | GET | [route](../../apps/web/src/app/admin/api/categories/list/route.ts) | Внутри route; читать исходник | [справочник](ADMIN_API.md) |
| `/admin/api/finance-logs` | GET | [route](../../apps/web/src/app/admin/api/finance-logs/route.ts) | Внутри route; читать исходник | [справочник](ADMIN_API.md) |
| `/admin/api/funnel-analytics` | GET | [route](../../apps/web/src/app/admin/api/funnel-analytics/route.ts) | Внутри route; читать исходник | [справочник](ADMIN_API.md) |
| `/admin/api/metrics/auth-flow` | GET | [route](../../apps/web/src/app/admin/api/metrics/auth-flow/route.ts) | Внутри route; читать исходник | [справочник](ADMIN_API.md) |
| `/admin/api/metrics` | GET | [route](../../apps/web/src/app/admin/api/metrics/route.ts) | Внутри route; читать исходник | [справочник](ADMIN_API.md) |
| `/admin/api/metrics/stats` | GET | [route](../../apps/web/src/app/admin/api/metrics/stats/route.ts) | Внутри route; читать исходник | [справочник](ADMIN_API.md) |
| `/admin/api/rating-config` | GET, POST | [route](../../apps/web/src/app/admin/api/rating-config/route.ts) | Внутри route; читать исходник | [справочник](ADMIN_API.md) |
| `/admin/api/role-applications/[id]/status` | POST | [route](../../apps/web/src/app/admin/api/role-applications/[id]/status/route.ts) | Внутри route; читать исходник | [справочник](ADMIN_API.md) |
| `/admin/api/role-applications` | GET | [route](../../apps/web/src/app/admin/api/role-applications/route.ts) | Внутри route; читать исходник | [справочник](ADMIN_API.md) |
| `/admin/api/roles/[id]/delete` | POST, DELETE | [route](../../apps/web/src/app/admin/api/roles/[id]/delete/route.ts) | Внутри route; читать исходник | [справочник](ADMIN_API.md) |
| `/admin/api/roles/[id]/update` | POST, PUT, PATCH | [route](../../apps/web/src/app/admin/api/roles/[id]/update/route.ts) | Внутри route; читать исходник | [справочник](ADMIN_API.md) |
| `/admin/api/roles/add` | POST | [route](../../apps/web/src/app/admin/api/roles/add/route.ts) | Внутри route; читать исходник | [справочник](ADMIN_API.md) |
| `/admin/api/roles/assign` | POST | [route](../../apps/web/src/app/admin/api/roles/assign/route.ts) | Внутри route; читать исходник | [справочник](ADMIN_API.md) |
| `/admin/api/roles/create` | POST | [route](../../apps/web/src/app/admin/api/roles/create/route.ts) | Внутри route; читать исходник | [справочник](ADMIN_API.md) |
| `/admin/api/roles/list` | GET, POST | [route](../../apps/web/src/app/admin/api/roles/list/route.ts) | Внутри route; читать исходник | [справочник](ADMIN_API.md) |
| `/admin/api/roles/set-many` | POST | [route](../../apps/web/src/app/admin/api/roles/set-many/route.ts) | Внутри route; читать исходник | [справочник](ADMIN_API.md) |
| `/admin/api/system-analytics/overview` | GET | [route](../../apps/web/src/app/admin/api/system-analytics/overview/route.ts) | Внутри route; читать исходник | [справочник](ADMIN_API.md) |
| `/admin/api/system-health` | GET | [route](../../apps/web/src/app/admin/api/system-health/route.ts) | Внутри route; читать исходник | [справочник](ADMIN_API.md) |
| `/admin/api/users/[id]/delete` | POST, DELETE | [route](../../apps/web/src/app/admin/api/users/[id]/delete/route.ts) | [runUserLifecycleHttp](../../apps/web/src/lib/userLifecycleHttpService.ts) | [справочник](ADMIN_API.md) |
| `/admin/api/users/[id]/send-magic-link` | POST | [route](../../apps/web/src/app/admin/api/users/[id]/send-magic-link/route.ts) | Внутри route; читать исходник | [справочник](ADMIN_API.md) |
| `/admin/api/users/[id]/set-password` | POST | [route](../../apps/web/src/app/admin/api/users/[id]/set-password/route.ts) | Внутри route; читать исходник | [справочник](ADMIN_API.md) |
| `/admin/api/users/[id]/suspend` | POST | [route](../../apps/web/src/app/admin/api/users/[id]/suspend/route.ts) | [runUserLifecycleHttp](../../apps/web/src/lib/userLifecycleHttpService.ts) | [справочник](ADMIN_API.md) |
| `/admin/api/users/[id]/toggle-super` | POST | [route](../../apps/web/src/app/admin/api/users/[id]/toggle-super/route.ts) | Внутри route; читать исходник | [справочник](ADMIN_API.md) |
| `/admin/api/users/[id]/update-basic` | POST, PUT | [route](../../apps/web/src/app/admin/api/users/[id]/update-basic/route.ts) | Внутри route; читать исходник | [справочник](ADMIN_API.md) |
| `/admin/api/users/create` | POST | [route](../../apps/web/src/app/admin/api/users/create/route.ts) | Внутри route; читать исходник | [справочник](ADMIN_API.md) |
| `/admin/api/users/list` | GET | [route](../../apps/web/src/app/admin/api/users/list/route.ts) | Внутри route; читать исходник | [справочник](ADMIN_API.md) |
| `/admin/api/users/search` | GET | [route](../../apps/web/src/app/admin/api/users/search/route.ts) | Внутри route; читать исходник | [справочник](ADMIN_API.md) |

## /api

| Путь | Явные методы | Исходник | Делегирование | Контракт |
| --- | --- | --- | --- | --- |
| `/api/account/deletion` | GET, POST, DELETE | [route](../../apps/web/src/app/api/account/deletion/route.ts) | Внутри route; читать исходник | [справочник](CLIENT_AND_AUTH_FLOWS.md) |
| `/api/admin/health-check` | GET | [route](../../apps/web/src/app/api/admin/health-check/route.ts) | [runAdminHealthCheckHttp](../../apps/web/src/lib/adminHealthCheckHttpService.ts) | [справочник](AUTH_AND_INTEGRATIONS.md) |
| `/api/admin/initialize-ratings` | POST | [route](../../apps/web/src/app/api/admin/initialize-ratings/route.ts) | [runInitializeRatingsHttp](../../apps/web/src/lib/initializeRatingsHttpService.ts) | [справочник](AUTH_AND_INTEGRATIONS.md) |
| `/api/admin/performance/stats` | GET | [route](../../apps/web/src/app/api/admin/performance/stats/route.ts) | [runPerformanceStatsHttp](../../apps/web/src/lib/performanceStatsHttpService.ts) | [справочник](AUTH_AND_INTEGRATIONS.md) |
| `/api/admin/promotions/debug` | GET | [route](../../apps/web/src/app/api/admin/promotions/debug/route.ts) | [runPromotionsDebugHttp](../../apps/web/src/lib/promotionsDebugHttpService.ts) | [справочник](AUTH_AND_INTEGRATIONS.md) |
| `/api/admin/ratings/debug-entities` | GET | [route](../../apps/web/src/app/api/admin/ratings/debug-entities/route.ts) | [runRatingsDebugEntitiesHttp](../../apps/web/src/lib/ratingsDebugEntitiesHttpService.ts) | [справочник](ADMIN_API.md) |
| `/api/admin/ratings/jobs` | GET | [route](../../apps/web/src/app/api/admin/ratings/jobs/route.ts) | [runRatingsJobsHttp](../../apps/web/src/lib/ratingsAdminHttpService.ts) | [справочник](ADMIN_API.md) |
| `/api/admin/ratings/recalculate` | POST | [route](../../apps/web/src/app/api/admin/ratings/recalculate/route.ts) | [runRatingsManualRecalculateHttp](../../apps/web/src/lib/ratingsManualRecalculateHttpService.ts) | [справочник](ADMIN_API.md) |
| `/api/admin/ratings/status` | GET | [route](../../apps/web/src/app/api/admin/ratings/status/route.ts) | [runRatingsStatusHttp](../../apps/web/src/lib/ratingsAdminHttpService.ts) | [справочник](AUTH_AND_INTEGRATIONS.md) |
| `/api/auth/connections/unlink` | POST | [route](../../apps/web/src/app/api/auth/connections/unlink/route.ts) | Внутри route; читать исходник | [справочник](CLIENT_AND_AUTH_FLOWS.md) |
| `/api/auth/mobile-exchange` | GET, POST | [route](../../apps/web/src/app/api/auth/mobile-exchange/route.ts) | [runMobileExchangeGetHttp, runMobileExchangePostHttp](../../apps/web/src/lib/mobileExchangeHttpService.ts) | [справочник](AUTH_AND_INTEGRATIONS.md) |
| `/api/auth/sign-out` | POST | [route](../../apps/web/src/app/api/auth/sign-out/route.ts) | [runAuthSignOutHttp](../../apps/web/src/lib/authSignOutHttpService.ts) | [справочник](AUTH_AND_INTEGRATIONS.md) |
| `/api/auth/telegram/link` | POST | [route](../../apps/web/src/app/api/auth/telegram/link/route.ts) | [runTelegramLinkHttp](../../apps/web/src/lib/telegramLinkHttpService.ts) | [справочник](AUTH_AND_INTEGRATIONS.md) |
| `/api/auth/telegram/login` | POST | [route](../../apps/web/src/app/api/auth/telegram/login/route.ts) | [runTelegramLoginHttp](../../apps/web/src/lib/telegramLoginHttpService.ts) | [справочник](AUTH_AND_INTEGRATIONS.md) |
| `/api/auth/telegram/mobile/callback` | POST | [route](../../apps/web/src/app/api/auth/telegram/mobile/callback/route.ts) | [runTelegramMobileCallbackHttp](../../apps/web/src/lib/telegramMobileCallbackHttpService.ts) | [справочник](CLIENT_AND_AUTH_FLOWS.md) |
| `/api/auth/telegram/mobile/confirm` | POST | [route](../../apps/web/src/app/api/auth/telegram/mobile/confirm/route.ts) | [runTelegramMobileConfirmHttp](../../apps/web/src/lib/telegramMobileConfirmHttpService.ts) | [справочник](CLIENT_AND_AUTH_FLOWS.md) |
| `/api/auth/telegram/mobile/start` | POST | [route](../../apps/web/src/app/api/auth/telegram/mobile/start/route.ts) | [runTelegramMobileStartHttp](../../apps/web/src/lib/telegramMobileStartHttpService.ts) | [справочник](CLIENT_AND_AUTH_FLOWS.md) |
| `/api/auth/telegram/mobile/status` | GET | [route](../../apps/web/src/app/api/auth/telegram/mobile/status/route.ts) | [runTelegramMobileStatusHttp](../../apps/web/src/lib/telegramMobileStatusHttpService.ts) | [справочник](CLIENT_AND_AUTH_FLOWS.md) |
| `/api/auth/telegram/profile-link` | POST | [route](../../apps/web/src/app/api/auth/telegram/profile-link/route.ts) | [runTelegramProfileLinkHttp](../../apps/web/src/lib/telegramProfileLinkHttpService.ts) | [справочник](CLIENT_AND_AUTH_FLOWS.md) |
| `/api/auth/telegram/web-login` | POST | [route](../../apps/web/src/app/api/auth/telegram/web-login/route.ts) | Внутри route; читать исходник | [справочник](CLIENT_AND_AUTH_FLOWS.md) |
| `/api/auth/whatsapp/create-session` | POST | [route](../../apps/web/src/app/api/auth/whatsapp/create-session/route.ts) | [runWhatsAppCreateSessionHttp](../../apps/web/src/lib/whatsAppCreateSessionHttpService.ts) | [справочник](CLIENT_AND_AUTH_FLOWS.md) |
| `/api/auth/whatsapp/mobile/start` | POST | [route](../../apps/web/src/app/api/auth/whatsapp/mobile/start/route.ts) | [runWhatsAppMobileStartHttp](../../apps/web/src/lib/whatsAppMobileStartHttpService.ts) | [справочник](CLIENT_AND_AUTH_FLOWS.md) |
| `/api/auth/whatsapp/mobile/verify` | POST | [route](../../apps/web/src/app/api/auth/whatsapp/mobile/verify/route.ts) | [runWhatsAppMobileVerifyHttp](../../apps/web/src/lib/whatsAppMobileVerifyHttpService.ts) | [справочник](CLIENT_AND_AUTH_FLOWS.md) |
| `/api/auth/whatsapp/send-otp` | POST | [route](../../apps/web/src/app/api/auth/whatsapp/send-otp/route.ts) | [runWhatsAppAuthSendOtpHttp](../../apps/web/src/lib/whatsAppAuthSendOtpHttpService.ts) | [справочник](CLIENT_AND_AUTH_FLOWS.md) |
| `/api/auth/whatsapp/verify-otp` | POST | [route](../../apps/web/src/app/api/auth/whatsapp/verify-otp/route.ts) | [runWhatsAppAuthVerifyOtpHttp](../../apps/web/src/lib/whatsAppAuthVerifyOtpHttpService.ts) | [справочник](CLIENT_AND_AUTH_FLOWS.md) |
| `/api/auth/yandex/callback` | GET | [route](../../apps/web/src/app/api/auth/yandex/callback/route.ts) | [runYandexAuthCallbackHttp](../../apps/web/src/lib/yandexAuthCallbackHttpService.ts) | [справочник](CLIENT_AND_AUTH_FLOWS.md) |
| `/api/auth/yandex/link/start` | POST | [route](../../apps/web/src/app/api/auth/yandex/link/start/route.ts) | Внутри route; читать исходник | [справочник](CLIENT_AND_AUTH_FLOWS.md) |
| `/api/auth/yandex/start` | GET | [route](../../apps/web/src/app/api/auth/yandex/start/route.ts) | Внутри route; читать исходник | [справочник](CLIENT_AND_AUTH_FLOWS.md) |
| `/api/bookings/[id]/cancel` | POST | [route](../../apps/web/src/app/api/bookings/[id]/cancel/route.ts) | [runBookingCancelHttp](../../apps/web/src/lib/bookingCancelHttpService.ts) | [справочник](BOOKING_AND_CATALOG.md) |
| `/api/bookings/[id]/mark-attendance` | POST | [route](../../apps/web/src/app/api/bookings/[id]/mark-attendance/route.ts) | [runMarkAttendanceHttp](../../apps/web/src/lib/markAttendanceHttpService.ts) | [справочник](BOOKING_AND_CATALOG.md) |
| `/api/bookings/client-identities` | POST | [route](../../apps/web/src/app/api/bookings/client-identities/route.ts) | [runDashboardBookingClientIdentityHttp](../../apps/web/src/lib/dashboardBookingClientIdentityHttpService.ts) | [справочник](BUSINESS_WORKFLOWS.md) |
| `/api/bookings/internal` | POST | [route](../../apps/web/src/app/api/bookings/internal/route.ts) | [runInternalBookingHttp](../../apps/web/src/lib/internalBookingHttpService.ts) | [справочник](BOOKING_AND_CATALOG.md) |
| `/api/branches/[id]/delete` | POST | [route](../../apps/web/src/app/api/branches/[id]/delete/route.ts) | [runBranchDeleteHttp](../../apps/web/src/lib/branchDeleteHttpService.ts) | [справочник](BOOKING_AND_CATALOG.md) |
| `/api/branches/[id]/schedule` | GET, POST | [route](../../apps/web/src/app/api/branches/[id]/schedule/route.ts) | [runGetBranchScheduleHttp, runSaveBranchScheduleHttp](../../apps/web/src/lib/branchScheduleHttpService.ts) | [справочник](BOOKING_AND_CATALOG.md) |
| `/api/branches/[id]/update` | POST | [route](../../apps/web/src/app/api/branches/[id]/update/route.ts) | [runBranchUpdateHttp](../../apps/web/src/lib/branchUpdateHttpService.ts) | [справочник](OPERATIONS_AND_TELEMETRY.md) |
| `/api/branches/create` | POST | [route](../../apps/web/src/app/api/branches/create/route.ts) | [runBranchCreateHttp](../../apps/web/src/lib/branchCreateHttpService.ts) | [справочник](BOOKING_AND_CATALOG.md) |
| `/api/branches/map` | GET | [route](../../apps/web/src/app/api/branches/map/route.ts) | [runBranchesMapHttp](../../apps/web/src/lib/branchesMapHttpService.ts) | [справочник](CLIENT_AND_AUTH_FLOWS.md) |
| `/api/branches/nearby` | GET | [route](../../apps/web/src/app/api/branches/nearby/route.ts) | [runBranchesNearbyHttp](../../apps/web/src/lib/branchesNearbyHttpService.ts) | [справочник](CLIENT_AND_AUTH_FLOWS.md) |
| `/api/business-applications` | POST | [route](../../apps/web/src/app/api/business-applications/route.ts) | Внутри route; читать исходник | [справочник](BUSINESS_WORKFLOWS.md) |
| `/api/business-role-applications/[id]` | DELETE | [route](../../apps/web/src/app/api/business-role-applications/[id]/route.ts) | Внутри route; читать исходник | [справочник](BUSINESS_WORKFLOWS.md) |
| `/api/business-role-applications` | GET, POST | [route](../../apps/web/src/app/api/business-role-applications/route.ts) | Внутри route; читать исходник | [справочник](BUSINESS_WORKFLOWS.md) |
| `/api/businesses/search` | GET | [route](../../apps/web/src/app/api/businesses/search/route.ts) | Внутри route; читать исходник | [справочник](CLIENT_AND_AUTH_FLOWS.md) |
| `/api/cron/analytics/daily` | GET, POST | [route](../../apps/web/src/app/api/cron/analytics/daily/route.ts) | [runAnalyticsDailyCronHttp](../../apps/web/src/lib/analyticsDailyCronHttpService.ts) | [справочник](OPERATIONS_AND_TELEMETRY.md) |
| `/api/cron/analytics/hourly-load` | GET, POST | [route](../../apps/web/src/app/api/cron/analytics/hourly-load/route.ts) | [runAnalyticsHourlyLoadCronHttp](../../apps/web/src/lib/analyticsHourlyLoadCronHttpService.ts) | [справочник](OPERATIONS_AND_TELEMETRY.md) |
| `/api/cron/booking-notifications` | GET | [route](../../apps/web/src/app/api/cron/booking-notifications/route.ts) | [runBookingNotificationWorker](../../apps/web/src/lib/notifications/outboxWorker.ts) | [справочник](AUTH_AND_INTEGRATIONS.md) |
| `/api/cron/close-shifts` | GET | [route](../../apps/web/src/app/api/cron/close-shifts/route.ts) | [runCloseShiftsCronHttp](../../apps/web/src/lib/closeShiftsCronHttpService.ts) | [справочник](AUTH_AND_INTEGRATIONS.md) |
| `/api/cron/data-retention` | GET | [route](../../apps/web/src/app/api/cron/data-retention/route.ts) | [runDataRetentionCronHttp](../../apps/web/src/lib/dataRetentionCronHttpService.ts) | [справочник](OPERATIONS_AND_TELEMETRY.md) |
| `/api/cron/health-check-alerts` | GET | [route](../../apps/web/src/app/api/cron/health-check-alerts/route.ts) | [runHealthCheckAlertsCronHttp](../../apps/web/src/lib/healthCheckAlertsCronHttpService.ts) | [справочник](AUTH_AND_INTEGRATIONS.md) |
| `/api/cron/recalculate-ratings` | GET | [route](../../apps/web/src/app/api/cron/recalculate-ratings/route.ts) | [runRecalculateRatingsCronHttp](../../apps/web/src/lib/recalculateRatingsCronHttpService.ts) | [справочник](AUTH_AND_INTEGRATIONS.md) |
| `/api/cron/whatsapp-inbox` | GET | [route](../../apps/web/src/app/api/cron/whatsapp-inbox/route.ts) | [runWhatsAppInboxWorker](../../apps/web/src/lib/whatsappInbox/worker.ts) | [справочник](AUTH_AND_INTEGRATIONS.md) |
| `/api/dashboard/analytics/load` | GET | [route](../../apps/web/src/app/api/dashboard/analytics/load/route.ts) | [runDashboardAnalyticsLoadHttp](../../apps/web/src/lib/dashboardAnalyticsHttpService.ts) | [справочник](BUSINESS_WORKFLOWS.md) |
| `/api/dashboard/analytics/overview` | GET | [route](../../apps/web/src/app/api/dashboard/analytics/overview/route.ts) | [runDashboardAnalyticsOverviewHttp](../../apps/web/src/lib/dashboardAnalyticsHttpService.ts) | [справочник](BUSINESS_WORKFLOWS.md) |
| `/api/dashboard/branches/[branchId]/promotions/[promotionId]` | PATCH, DELETE | [route](../../apps/web/src/app/api/dashboard/branches/[branchId]/promotions/[promotionId]/route.ts) | [runDeleteBranchPromotionHttp, runUpdateBranchPromotionHttp](../../apps/web/src/lib/branchPromotionHttpService.ts) | [справочник](STAFF_AND_FINANCE.md) |
| `/api/dashboard/branches/[branchId]/promotions` | GET, POST | [route](../../apps/web/src/app/api/dashboard/branches/[branchId]/promotions/route.ts) | [runCreateBranchPromotionHttp, runListBranchPromotionsHttp](../../apps/web/src/lib/branchPromotionsHttpService.ts) | [справочник](STAFF_AND_FINANCE.md) |
| `/api/dashboard/branches/list` | GET | [route](../../apps/web/src/app/api/dashboard/branches/list/route.ts) | [runDashboardBranchesListHttp](../../apps/web/src/lib/dashboardBranchesListHttpService.ts) | [справочник](BUSINESS_WORKFLOWS.md) |
| `/api/dashboard/clients/[clientId]/visit-packages` | POST | [route](../../apps/web/src/app/api/dashboard/clients/[clientId]/visit-packages/route.ts) | [runSellVisitPackageHttp](../../apps/web/src/lib/visitPackagesHttpService.ts) | [справочник](BUSINESS_WORKFLOWS.md) |
| `/api/dashboard/contact-settings` | POST | [route](../../apps/web/src/app/api/dashboard/contact-settings/route.ts) | Внутри route; читать исходник | [справочник](BUSINESS_WORKFLOWS.md) |
| `/api/dashboard/finance/[id]/stats` | GET | [route](../../apps/web/src/app/api/dashboard/finance/[id]/stats/route.ts) | [re-export](../../apps/web/src/app/api/dashboard/staff/[id]/finance/stats/route.ts) | [справочник](BUSINESS_WORKFLOWS.md) |
| `/api/dashboard/finance/all` | GET | [route](../../apps/web/src/app/api/dashboard/finance/all/route.ts) | [re-export](../../apps/web/src/app/api/dashboard/staff/finance/all/route.ts) | [справочник](STAFF_AND_FINANCE.md) |
| `/api/dashboard/staff-shifts/[id]/update-hours` | POST | [route](../../apps/web/src/app/api/dashboard/staff-shifts/[id]/update-hours/route.ts) | [runDashboardStaffShiftUpdateHoursHttp](../../apps/web/src/lib/dashboardStaffShiftUpdateHoursHttpService.ts) | [справочник](STAFF_AND_FINANCE.md) |
| `/api/dashboard/staff/[id]/finance/audit-log` | GET | [route](../../apps/web/src/app/api/dashboard/staff/[id]/finance/audit-log/route.ts) | [runStaffFinanceAuditLogHttp](../../apps/web/src/lib/staffFinanceAuditLogHttpService.ts) | [справочник](BUSINESS_WORKFLOWS.md) |
| `/api/dashboard/staff/[id]/finance` | GET | [route](../../apps/web/src/app/api/dashboard/staff/[id]/finance/route.ts) | [runDeprecatedStaffFinanceHttp](../../apps/web/src/lib/deprecatedStaffFinanceHttpService.ts) | [справочник](STAFF_AND_FINANCE.md) |
| `/api/dashboard/staff/[id]/finance/stats` | GET | [route](../../apps/web/src/app/api/dashboard/staff/[id]/finance/stats/route.ts) | [runStaffFinanceStatsHttp](../../apps/web/src/lib/staffFinanceStatsHttpService.ts) | [справочник](STAFF_AND_FINANCE.md) |
| `/api/dashboard/staff/[id]/shift/close` | POST | [route](../../apps/web/src/app/api/dashboard/staff/[id]/shift/close/route.ts) | [runDashboardStaffShiftCloseHttp](../../apps/web/src/lib/dashboardStaffShiftCloseHttpService.ts) | [справочник](BUSINESS_WORKFLOWS.md) |
| `/api/dashboard/staff/[id]/shift/open` | POST | [route](../../apps/web/src/app/api/dashboard/staff/[id]/shift/open/route.ts) | [runDashboardStaffShiftOpenHttp](../../apps/web/src/lib/dashboardStaffShiftOpenHttpService.ts) | [справочник](STAFF_AND_FINANCE.md) |
| `/api/dashboard/staff/finance/all` | GET | [route](../../apps/web/src/app/api/dashboard/staff/finance/all/route.ts) | [runFinanceAllDashboardHttp](../../apps/web/src/lib/financeAllDashboardHttpService.ts) | [справочник](STAFF_AND_FINANCE.md) |
| `/api/dashboard/visit-package-plans/[id]` | PATCH | [route](../../apps/web/src/app/api/dashboard/visit-package-plans/[id]/route.ts) | [runVisitPackagePlanPatchHttp](../../apps/web/src/lib/visitPackagePlanPatchHttpService.ts) | [справочник](BUSINESS_WORKFLOWS.md) |
| `/api/dashboard/visit-package-plans` | GET, POST | [route](../../apps/web/src/app/api/dashboard/visit-package-plans/route.ts) | [runCreateVisitPackagePlanHttp, runListVisitPackagePlansHttp](../../apps/web/src/lib/visitPackagePlansHttpService.ts) | [справочник](BUSINESS_WORKFLOWS.md) |
| `/api/dashboard/visit-packages` | GET | [route](../../apps/web/src/app/api/dashboard/visit-packages/route.ts) | [runListVisitPackagesHttp](../../apps/web/src/lib/visitPackagesHttpService.ts) | [справочник](BUSINESS_WORKFLOWS.md) |
| `/api/funnel-events` | POST | [route](../../apps/web/src/app/api/funnel-events/route.ts) | [runFunnelEventsHttp](../../apps/web/src/lib/funnelEventsHttpService.ts) | [справочник](OPERATIONS_AND_TELEMETRY.md) |
| `/api/me/current-business` | GET, POST | [route](../../apps/web/src/app/api/me/current-business/route.ts) | [runGetCurrentBusinessHttp, runSetCurrentBusinessHttp](../../apps/web/src/lib/currentBusinessHttpService.ts) | [справочник](BUSINESS_WORKFLOWS.md) |
| `/api/me/visit-packages` | GET | [route](../../apps/web/src/app/api/me/visit-packages/route.ts) | [runMeVisitPackagesHttp](../../apps/web/src/lib/meVisitPackagesHttpService.ts) | [справочник](BUSINESS_WORKFLOWS.md) |
| `/api/metrics/frontend` | POST | [route](../../apps/web/src/app/api/metrics/frontend/route.ts) | [runFrontendMetricsHttp](../../apps/web/src/lib/frontendMetricsHttpService.ts) | [справочник](OPERATIONS_AND_TELEMETRY.md) |
| `/api/mobile/bookings/[id]` | GET, POST | [route](../../apps/web/src/app/api/mobile/bookings/[id]/route.ts) | [runCancelMobileBookingHttp, runGetMobileBookingDetailsHttp](../../apps/web/src/lib/mobileBookingsHttpService.ts) | [справочник](CLIENT_AND_AUTH_FLOWS.md) |
| `/api/mobile/bookings` | GET | [route](../../apps/web/src/app/api/mobile/bookings/route.ts) | [runListMobileBookingsHttp](../../apps/web/src/lib/mobileBookingsHttpService.ts) | [справочник](CLIENT_AND_AUTH_FLOWS.md) |
| `/api/mobile/businesses` | GET | [route](../../apps/web/src/app/api/mobile/businesses/route.ts) | [runMobileBusinessesHttp](../../apps/web/src/lib/mobileBusinessesHttpService.ts) | [справочник](CLIENT_AND_AUTH_FLOWS.md) |
| `/api/notify/ping` | POST | [route](../../apps/web/src/app/api/notify/ping/route.ts) | [runNotifyPingHttp](../../apps/web/src/lib/notifyPingHttpService.ts) | [справочник](AUTH_AND_INTEGRATIONS.md) |
| `/api/notify` | POST | [route](../../apps/web/src/app/api/notify/route.ts) | [runNotifyHttp](../../apps/web/src/lib/notifyHttpService.ts) | [справочник](AUTH_AND_INTEGRATIONS.md) |
| `/api/profile/notification-emails` | GET | [route](../../apps/web/src/app/api/profile/notification-emails/route.ts) | Внутри route; читать исходник | [справочник](CLIENT_AND_AUTH_FLOWS.md) |
| `/api/profile/update` | POST | [route](../../apps/web/src/app/api/profile/update/route.ts) | [runProfileUpdateHttp](../../apps/web/src/lib/profileUpdateHttpService.ts) | [справочник](BOOKING_AND_CATALOG.md) |
| `/api/public/work-locations` | GET | [route](../../apps/web/src/app/api/public/work-locations/route.ts) | Внутри route; читать исходник | [справочник](CLIENT_AND_AUTH_FLOWS.md) |
| `/api/quick-book-guest` | POST | [route](../../apps/web/src/app/api/quick-book-guest/route.ts) | [runQuickBookGuestHttp](../../apps/web/src/lib/quickBookGuestHttpService.ts) | [справочник](BOOKING_AND_CATALOG.md) |
| `/api/quick-hold` | POST | [route](../../apps/web/src/app/api/quick-hold/route.ts) | [runQuickHoldHttp](../../apps/web/src/lib/quickHoldHttpService.ts) | [справочник](BOOKING_AND_CATALOG.md) |
| `/api/reviews/create` | POST | [route](../../apps/web/src/app/api/reviews/create/route.ts) | [runReviewCreateHttp](../../apps/web/src/lib/reviewCreateHttpService.ts) | [справочник](BOOKING_AND_CATALOG.md) |
| `/api/reviews/update` | POST | [route](../../apps/web/src/app/api/reviews/update/route.ts) | [runReviewUpdateHttp](../../apps/web/src/lib/reviewUpdateHttpService.ts) | [справочник](BOOKING_AND_CATALOG.md) |
| `/api/services/[id]/delete` | POST | [route](../../apps/web/src/app/api/services/[id]/delete/route.ts) | [runServiceDeleteHttp](../../apps/web/src/lib/serviceDeleteHttpService.ts) | [справочник](BOOKING_AND_CATALOG.md) |
| `/api/services/[id]/update` | POST | [route](../../apps/web/src/app/api/services/[id]/update/route.ts) | [runServiceUpdateHttp](../../apps/web/src/lib/serviceUpdateHttpService.ts) | [справочник](BOOKING_AND_CATALOG.md) |
| `/api/services/create` | POST | [route](../../apps/web/src/app/api/services/create/route.ts) | [runServiceCreateHttp](../../apps/web/src/lib/serviceCreateHttpService.ts) | [справочник](BOOKING_AND_CATALOG.md) |
| `/api/staff/[id]/delete` | POST | [route](../../apps/web/src/app/api/staff/[id]/delete/route.ts) | [runStaffDeleteHttp](../../apps/web/src/lib/staffDeleteHttpService.ts) | [справочник](STAFF_AND_FINANCE.md) |
| `/api/staff/[id]/dismiss` | POST | [route](../../apps/web/src/app/api/staff/[id]/dismiss/route.ts) | [runStaffDismissHttp](../../apps/web/src/lib/staffDismissHttpService.ts) | [справочник](STAFF_AND_FINANCE.md) |
| `/api/staff/[id]/restore` | POST | [route](../../apps/web/src/app/api/staff/[id]/restore/route.ts) | [runStaffRestoreHttp](../../apps/web/src/lib/staffRestoreHttpService.ts) | [справочник](STAFF_AND_FINANCE.md) |
| `/api/staff/[id]/schedule` | GET, POST | [route](../../apps/web/src/app/api/staff/[id]/schedule/route.ts) | Внутри route; читать исходник | [справочник](BUSINESS_WORKFLOWS.md) |
| `/api/staff/[id]/time-off` | GET, POST, PATCH | [route](../../apps/web/src/app/api/staff/[id]/time-off/route.ts) | Внутри route; читать исходник | [справочник](BUSINESS_WORKFLOWS.md) |
| `/api/staff/[id]/transfer` | POST | [route](../../apps/web/src/app/api/staff/[id]/transfer/route.ts) | [runStaffTransferHttp](../../apps/web/src/lib/staffTransferHttpService.ts) | [справочник](STAFF_AND_FINANCE.md) |
| `/api/staff/[id]/update` | POST | [route](../../apps/web/src/app/api/staff/[id]/update/route.ts) | [runStaffUpdateByIdHttp](../../apps/web/src/lib/staffUpdateByIdHttpService.ts) | [справочник](STAFF_AND_FINANCE.md) |
| `/api/staff/avatar/remove` | POST | [route](../../apps/web/src/app/api/staff/avatar/remove/route.ts) | [runStaffAvatarRemoveHttp](../../apps/web/src/lib/staffAvatarRemoveHttpService.ts) | [справочник](STAFF_AND_FINANCE.md) |
| `/api/staff/avatar/upload` | POST | [route](../../apps/web/src/app/api/staff/avatar/upload/route.ts) | [runStaffAvatarUploadHttp](../../apps/web/src/lib/staffAvatarUploadHttpService.ts) | [справочник](STAFF_AND_FINANCE.md) |
| `/api/staff/create-from-user` | POST | [route](../../apps/web/src/app/api/staff/create-from-user/route.ts) | [runStaffCreateFromUserHttp](../../apps/web/src/lib/staffCreateFromUserHttpService.ts) | [справочник](STAFF_AND_FINANCE.md) |
| `/api/staff/create` | POST | [route](../../apps/web/src/app/api/staff/create/route.ts) | [runStaffCreateHttp](../../apps/web/src/lib/staffCreateHttpService.ts) | [справочник](STAFF_AND_FINANCE.md) |
| `/api/staff/finance` | GET | [route](../../apps/web/src/app/api/staff/finance/route.ts) | [runStaffFinanceHttp](../../apps/web/src/lib/staffFinanceHttpService.ts) | [справочник](STAFF_AND_FINANCE.md) |
| `/api/staff/me/schedule` | GET | [route](../../apps/web/src/app/api/staff/me/schedule/route.ts) | Внутри route; читать исходник | [справочник](BUSINESS_WORKFLOWS.md) |
| `/api/staff/shift/close` | POST | [route](../../apps/web/src/app/api/staff/shift/close/route.ts) | [runStaffShiftCloseHttp](../../apps/web/src/lib/staffShiftCloseHttpService.ts) | [справочник](STAFF_AND_FINANCE.md) |
| `/api/staff/shift/items` | POST | [route](../../apps/web/src/app/api/staff/shift/items/route.ts) | [runStaffShiftItemsHttp](../../apps/web/src/lib/staffShiftItemsHttpService.ts) | [справочник](STAFF_AND_FINANCE.md) |
| `/api/staff/shift/open` | POST | [route](../../apps/web/src/app/api/staff/shift/open/route.ts) | [runStaffShiftOpenHttp](../../apps/web/src/lib/staffShiftOpenHttpService.ts) | [справочник](STAFF_AND_FINANCE.md) |
| `/api/staff/shift/today` | GET | [route](../../apps/web/src/app/api/staff/shift/today/route.ts) | [runStaffShiftTodayHttp](../../apps/web/src/lib/staffShiftTodayHttpService.ts) | [справочник](STAFF_AND_FINANCE.md) |
| `/api/staff/sync-roles` | POST | [route](../../apps/web/src/app/api/staff/sync-roles/route.ts) | [runStaffSyncRolesHttp](../../apps/web/src/lib/staffSyncRolesHttpService.ts) | [справочник](BUSINESS_WORKFLOWS.md) |
| `/api/staff/update` | POST | [route](../../apps/web/src/app/api/staff/update/route.ts) | [runStaffUpdateHttp](../../apps/web/src/lib/staffUpdateHttpService.ts) | [справочник](STAFF_AND_FINANCE.md) |
| `/api/staff/work-locations` | GET | [route](../../apps/web/src/app/api/staff/work-locations/route.ts) | Внутри route; читать исходник | [справочник](BUSINESS_WORKFLOWS.md) |
| `/api/swagger.json` | GET | [route](../../apps/web/src/app/api/swagger.json/route.ts) | Внутри route; читать исходник | [справочник](OPERATIONS_AND_TELEMETRY.md) |
| `/api/user/update-phone` | POST | [route](../../apps/web/src/app/api/user/update-phone/route.ts) | [runUserUpdatePhoneHttp](../../apps/web/src/lib/userUpdatePhoneHttpService.ts) | [справочник](BOOKING_AND_CATALOG.md) |
| `/api/users/search` | POST | [route](../../apps/web/src/app/api/users/search/route.tsx) | [runUsersSearchHttp](../../apps/web/src/lib/usersSearchHttpService.ts) | [справочник](CLIENT_AND_AUTH_FLOWS.md) |
| `/api/webhooks/telegram` | POST | [route](../../apps/web/src/app/api/webhooks/telegram/route.ts) | [runTelegramWebhookPostHttp](../../apps/web/src/lib/telegramWebhookHttpService.ts) | [справочник](OPERATIONS_AND_TELEMETRY.md) |
| `/api/webhooks/whatsapp` | GET, POST | [route](../../apps/web/src/app/api/webhooks/whatsapp/route.ts) | [runWhatsAppWebhookGetHttp, runWhatsAppWebhookPostHttp](../../apps/web/src/lib/whatsAppWebhookHttpService.ts) | [справочник](AUTH_AND_INTEGRATIONS.md) |
| `/api/whatsapp/diagnose` | GET | [route](../../apps/web/src/app/api/whatsapp/diagnose/route.ts) | [runWhatsAppDiagnoseHttp](../../apps/web/src/lib/whatsAppDiagnoseHttpService.ts) | [справочник](OPERATIONS_AND_TELEMETRY.md) |
| `/api/whatsapp/get-business-account` | GET | [route](../../apps/web/src/app/api/whatsapp/get-business-account/route.ts) | [runWhatsAppBusinessAccountLookupHttp](../../apps/web/src/lib/whatsAppAccountLookupHttpService.ts) | [справочник](OPERATIONS_AND_TELEMETRY.md) |
| `/api/whatsapp/get-phone-numbers` | GET | [route](../../apps/web/src/app/api/whatsapp/get-phone-numbers/route.ts) | [runWhatsAppPhoneNumbersLookupHttp](../../apps/web/src/lib/whatsAppAccountLookupHttpService.ts) | [справочник](OPERATIONS_AND_TELEMETRY.md) |
| `/api/whatsapp/send-otp` | POST | [route](../../apps/web/src/app/api/whatsapp/send-otp/route.ts) | [runWhatsAppSendOtpHttp](../../apps/web/src/lib/whatsAppSendOtpHttpService.ts) | [справочник](AUTH_AND_INTEGRATIONS.md) |
| `/api/whatsapp/test` | GET | [route](../../apps/web/src/app/api/whatsapp/test/route.ts) | [runWhatsAppTestHttp](../../apps/web/src/lib/whatsAppTestHttpService.ts) | [справочник](OPERATIONS_AND_TELEMETRY.md) |
| `/api/whatsapp/verify-otp` | POST | [route](../../apps/web/src/app/api/whatsapp/verify-otp/route.ts) | [runWhatsAppVerifyOtpHttp](../../apps/web/src/lib/whatsAppVerifyOtpHttpService.ts) | [справочник](AUTH_AND_INTEGRATIONS.md) |

## /auth

| Путь | Явные методы | Исходник | Делегирование | Контракт |
| --- | --- | --- | --- | --- |
| `/auth/callback/google` | GET | [route](../../apps/web/src/app/auth/callback/google/route.ts) | Внутри route; читать исходник | [справочник](CLIENT_AND_AUTH_FLOWS.md) |

## /booking

| Путь | Явные методы | Исходник | Делегирование | Контракт |
| --- | --- | --- | --- | --- |
| `/booking/[id]/cancel` | POST | [route](../../apps/web/src/app/booking/[id]/cancel/route.ts) | [runServerCancelBooking](../../apps/web/src/lib/serverCancelBookingService.ts) | [справочник](CLIENT_AND_AUTH_FLOWS.md) |

## /dashboard

| Путь | Явные методы | Исходник | Делегирование | Контракт |
| --- | --- | --- | --- | --- |
| `/dashboard/api/branches/[id]/admins/add` | POST | [route](../../apps/web/src/app/dashboard/api/branches/[id]/admins/add/route.ts) | [runBranchAdminChangeHttp](../../apps/web/src/lib/branchAdminChangeHttpService.ts) | [справочник](BUSINESS_WORKFLOWS.md) |
| `/dashboard/api/branches/[id]/admins/list` | POST | [route](../../apps/web/src/app/dashboard/api/branches/[id]/admins/list/route.ts) | Внутри route; читать исходник | [справочник](BUSINESS_WORKFLOWS.md) |
| `/dashboard/api/branches/[id]/admins/remove` | POST | [route](../../apps/web/src/app/dashboard/api/branches/[id]/admins/remove/route.ts) | [runBranchAdminChangeHttp](../../apps/web/src/lib/branchAdminChangeHttpService.ts) | [справочник](BUSINESS_WORKFLOWS.md) |
| `/dashboard/api/role-applications/[id]/status` | POST | [route](../../apps/web/src/app/dashboard/api/role-applications/[id]/status/route.ts) | Внутри route; читать исходник | [справочник](BUSINESS_WORKFLOWS.md) |
| `/dashboard/api/role-applications` | GET | [route](../../apps/web/src/app/dashboard/api/role-applications/route.ts) | Внутри route; читать исходник | [справочник](BUSINESS_WORKFLOWS.md) |
