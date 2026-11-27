# Доступ к Supabase из сетей, где он заблокирован (R25-31)

Статус: план и сравнение вариантов, 28 ноября 2026. Код и настройки не менялись. Источник проблемы — [R25-31 в обзоре проекта](PROJECT_REVIEW_2026-11-25.md) и пункт 2 в [действиях владельца](OWNER_ACTIONS.md).

## Коротко

В части сетей Кыргызстана адреса `*.supabase.co` не открываются, а `kezek.vercel.app` открывается. Приложение и часть сайта обращаются к Supabase прямо с телефона или браузера. Поэтому у таких клиентов не работают вход, страница бизнеса, слоты и кабинеты.

| Вариант | Помогает ли | Цена в месяц | Что делает владелец | Усилие агентов | Риск |
| --- | --- | --- | --- | --- | --- |
| 0. Проверочная страница: что именно блокируется | Сам не чинит, но показывает, какой вариант сработает | 0 | Открыть страницу с телефона в «плохой» сети и прислать снимок экрана | 0,5 дня | Нет |
| A. Свой домен в Supabase (Custom Domain) | **Неизвестно.** Поможет, если блокируют имя `supabase.co`. Не поможет, если блокируют адреса Cloudflare: домен, скорее всего, ведёт на те же серверы | 25 $ (Pro, нужен и для бэкапов) + 10 $ за домен | Купить домен, перейти на Pro, добавить две DNS-записи, добавить адрес возврата в Google | 1 день | Средний: можно заплатить и не получить результата |
| B1. Прокси через сайт на Vercel (`kezek.vercel.app/sb/...`) | **Да**, сайт в этих сетях открывается. Вход через Google в браузере остаётся сломан, его чиним отдельно (шаг 3) | Примерно 0–5 $ сверх текущего тарифа Vercel (оценка) | Ничего, кроме новой сборки приложения | 2 дня + 2–3 дня на вход через Google | Средний: общие лимиты входа по IP, нельзя кешировать личные ответы |
| B2. Cloudflare Worker | Неизвестно: Worker работает в той же сети Cloudflare, что и Supabase | 0 (до 100 000 запросов в день) или 5 $ | Завести аккаунт Cloudflare и выложить код | 1–2 дня | Средний: может быть заблокирован так же |
| B3. Свой сервер (VPS) с nginx | Да, если не попадёт под ту же блокировку | Около 6 € (Hetzner) | Купить сервер и домен, следить за оплатой | 2 дня + обслуживание | Высокий для одного владельца без админа: обновления, падения, сертификаты |
| C. Все данные через API сайта | Частично: вход и обновление токенов всё равно идут в Supabase | 0 | Ничего | 8–12 дней | Высокий: большая переделка, расхождения сайта и приложения |

**Рекомендация:** сначала проверочная страница (вариант 0), затем прокси через Vercel (B1) и вход через Google без перехода на `supabase.co`. Свой домен в Supabase (A) имеет смысл, только если проверка покажет, что блокируется имя, а не адреса. Подробно — в разделах [Рекомендация](#рекомендация) и [Порядок внедрения](#порядок-внедрения).

## Что известно о блокировке

- В обзоре записано: соединения с `*.supabase.co` и `api.supabase.com` не устанавливаются, адреса Cloudflare 8.6.112.0 и 8.47.69.0. Обе подсети принадлежат Cloudflare (AS13335) по данным [ipinfo](https://ipinfo.io/AS13335/8.47.69.0/24) и [AbuseIPDB](https://www.abuseipdb.com/whois/8.6.112.0).
- 28 ноября из сети, где работали агенты, адрес проекта `beulnmftzbmtbdlgurht.supabase.co` открылся. Обычный DNS и 1.1.1.1 вернули другие адреса Cloudflare: 104.18.38.10 и 172.64.149.246. Значит, блокировка зависит от сети. Возможно, в «плохой» сети DNS отвечает иначе. **Не проверено**: агенты не имеют доступа к «плохой» сети.
- Supabase описывает [два типа блокировок](https://supabase.com/blog/navigating-regional-network-blocks). Первый — по DNS (ОАЭ, 2025): имя не находится или указывает не туда. Второй — по IP (Йемен, 2026): пакеты отбрасываются, соединение не устанавливается. От типа зависит, какой вариант сработает:
  - **блокируют имя** — помогут свой домен (A), Worker (B2) и прокси (B1);
  - **блокируют адреса Cloudflare** — поможет только то, что не стоит на Cloudflare: Vercel (B1) или свой сервер (B3).
- `api.supabase.com` — это управление проектом (панель, CLI, миграции). Клиентов он не касается, мешает только агентам и владельцу.

## Что сейчас ходит в Supabase напрямую

### Приложение (`apps/mobile`)

Клиент Supabase создаётся в [`src/lib/supabase.ts`](../apps/mobile/src/lib/supabase.ts). Адрес берётся из `EXPO_PUBLIC_SUPABASE_URL`, по умолчанию прописан в [`app.config.ts`](../apps/mobile/app.config.ts) (строка 8: `https://beulnmftzbmtbdlgurht.supabase.co`). Все запросы клиента идут через одну функцию `fetch` из [`src/lib/supabaseFetch.ts`](../apps/mobile/src/lib/supabaseFetch.ts). Это удобная точка, чтобы переключить адрес. OTA-обновлений (`expo-updates`) нет, поэтому любое изменение попадёт к людям только с новой сборкой.

| Функция | Что вызывается | Файлы |
| --- | --- | --- |
| Сессия и токены | `getSession`, `onAuthStateChange`, автообновление токена (`/auth/v1/token`) | [`useRootNavigationSession.ts`](../apps/mobile/src/navigation/useRootNavigationSession.ts) (также `exchangeCodeForSession`, `setSession`), [`lib/api.ts`](../apps/mobile/src/lib/api.ts), [`currentUser.ts`](../apps/mobile/src/lib/currentUser.ts), [`signOut.ts`](../apps/mobile/src/lib/signOut.ts), [`LanguageProvider.tsx`](../apps/mobile/src/i18n/LanguageProvider.tsx) |
| Вход по email-коду | `signInWithOtp`, `verifyOtp`, `emailRedirectTo: kezek://auth/callback` | [`VerifyScreen.tsx`](../apps/mobile/src/screens/auth/VerifyScreen.tsx) |
| Google | `signInWithOAuth` → браузер на `…supabase.co/auth/v1/authorize` → Google → `…supabase.co/auth/v1/callback` → `kezek://auth/callback` (PKCE) | [`useGoogleSignInFlow.ts`](../apps/mobile/src/screens/auth/hooks/useGoogleSignInFlow.ts), привязка — `linkIdentity` в [`profileApi.ts`](../apps/mobile/src/screens/profile/profileApi.ts) |
| Apple (iOS) | `signInWithIdToken` (прямой запрос без браузера), `updateUser` | [`useAppleSignInFlow.ts`](../apps/mobile/src/screens/auth/hooks/useAppleSignInFlow.ts) |
| WhatsApp, Telegram | Код проверяет сайт (сервер), затем приложение вызывает `setSession`, а токен обновляет уже Supabase | [`WhatsAppScreen.tsx`](../apps/mobile/src/screens/auth/WhatsAppScreen.tsx), [`useRootNavigationSession.ts`](../apps/mobile/src/navigation/useRootNavigationSession.ts) |
| Роли | `user_roles`, `roles`, `businesses`, `staff`, RPC `is_super_admin` | [`useUserRole.ts`](../apps/mobile/src/hooks/useUserRole.ts), [`useCurrentStaff.ts`](../apps/mobile/src/hooks/useCurrentStaff.ts), [`useBusinessWithBranches.ts`](../apps/mobile/src/hooks/useBusinessWithBranches.ts) |
| Страница бизнеса и запись | `businesses`, `branches`, `services`, `staff`, `service_staff`, `branch_promotions`, `bookings`, RPC `get_free_slots_*` | [`useBusinessPageData.ts`](../apps/mobile/src/screens/business/useBusinessPageData.ts), [`useBookingScreenData.ts`](../apps/mobile/src/screens/bookingFlow/useBookingScreenData.ts), [`useBookingStep2Services.ts`](../apps/mobile/src/screens/booking/useBookingStep2Services.ts), [`useBookingStep3Staff.ts`](../apps/mobile/src/screens/booking/useBookingStep3Staff.ts), [`useBookingStep5Slots.ts`](../apps/mobile/src/screens/booking/useBookingStep5Slots.ts), [`useClientDayBookings.ts`](../apps/mobile/src/screens/booking/useClientDayBookings.ts), [`homeDiscovery.ts`](../apps/mobile/src/screens/home/homeDiscovery.ts) (акции), [`bookingReschedule.ts`](../apps/mobile/src/lib/bookingReschedule.ts) |
| Профиль, кабинет, заявка | `profiles`, `categories`, `user_notification_emails` | [`useProfileScreenData.ts`](../apps/mobile/src/screens/profile/useProfileScreenData.ts), [`useCabinetScreenData.ts`](../apps/mobile/src/screens/cabinet/useCabinetScreenData.ts), [`applicationApi.ts`](../apps/mobile/src/screens/apply/applicationApi.ts) |
| Кабинет бизнеса | `bookings`, `services`, `staff`, `branches`, `service_staff`, `visit_package_plans`, `staff_schedule_rules`, RPC `dashboard_bookings_page` | [`bookingsData.ts`](../apps/mobile/src/screens/manage/bookings/bookingsData.ts), [`ServiceMastersSection.tsx`](../apps/mobile/src/screens/manage/catalog/ServiceMastersSection.tsx), [`visitPackagesData.ts`](../apps/mobile/src/screens/manage/visitPackages/visitPackagesData.ts), [`LegacyScheduleEditor.tsx`](../apps/mobile/src/screens/manageStaff/LegacyScheduleEditor.tsx), [`ManageStaffNewScreen.tsx`](../apps/mobile/src/screens/manageStaff/ManageStaffNewScreen.tsx), [`ManageStaffSlotsScreen.tsx`](../apps/mobile/src/screens/manageStaff/ManageStaffSlotsScreen.tsx), [`StaffDetailSections.tsx`](../apps/mobile/src/screens/manageStaff/StaffDetailSections.tsx) |
| Кабинет мастера | `bookings`, `service_staff`, `services`, `branches`, `staff_schedule_rules` | [`useStaffBookings.ts`](../apps/mobile/src/screens/staff/useStaffBookings.ts), [`useStaffServices.ts`](../apps/mobile/src/screens/staff/useStaffServices.ts), [`staffCreateBooking.ts`](../apps/mobile/src/screens/staff/staffCreateBooking.ts), [`useStaffScheduleData.ts`](../apps/mobile/src/screens/staffSchedule/useStaffScheduleData.ts) |
| Файлы (storage) | Напрямую ничего не загружается: фото мастера идёт через `POST /api/staff/avatar/upload` ([`staffAvatar.ts`](../apps/mobile/src/lib/staffAvatar.ts)). Но показ фото грузит `staff.avatar_url`, а это адрес `supabase.co` | [`BookingStep3Staff.tsx`](../apps/mobile/src/screens/booking/BookingStep3Staff.tsx), [`BusinessScreen.tsx`](../apps/mobile/src/screens/business/BusinessScreen.tsx) |
| Realtime (websocket) | Не используется | — |

Уже переведены на API сайта: список бизнесов и категории ([`homeDiscovery.ts`](../apps/mobile/src/screens/home/homeDiscovery.ts), `GET /api/mobile/categories`), загрузка фото, создание и подтверждение записей, вход через WhatsApp и Telegram.

### Сайт в браузере (`apps/web`)

Браузерный клиент создаётся в [`src/lib/supabaseClient.ts`](../apps/web/src/lib/supabaseClient.ts) (`createBrowserClient` из `@supabase/ssr`, адрес `NEXT_PUBLIC_SUPABASE_URL`, сессия в cookie). CSP в [`next.config.ts`](../apps/web/next.config.ts) разрешает `connect-src https://*.supabase.co wss://*.supabase.co`.

| Функция | Что вызывается | Файлы (`apps/web/src/...`) |
| --- | --- | --- |
| Вход и сессия | `signInWithOAuth` (Google, браузер уходит на `supabase.co`), `signInWithOtp`, `verifyOtp`, `exchangeCodeForSession`, `setSession` (WhatsApp, Telegram), `getUser`, `onAuthStateChange`, `signOut`, `linkIdentity` | [`auth/callback/page.tsx`](../apps/web/src/app/auth/callback/page.tsx), [`useSignInSubmitActions.ts`](../apps/web/src/app/auth/sign-in/useSignInSubmitActions.ts), [`VerifyPage.tsx`](../apps/web/src/app/auth/verify/VerifyPage.tsx), [`VerifyOtpPage.tsx`](../apps/web/src/app/auth/verify-otp/VerifyOtpPage.tsx), [`auth/whatsapp/page.tsx`](../apps/web/src/app/auth/whatsapp/page.tsx), [`AuthStatusWrapper.tsx`](../apps/web/src/app/_components/AuthStatusWrapper.tsx), [`SignOutButton.tsx`](../apps/web/src/app/_components/SignOutButton.tsx), [`ProfileForm.tsx`](../apps/web/src/app/cabinet/components/ProfileForm.tsx) |
| Роли после входа | `businesses`, `staff`, RPC `is_super_admin`, `my_role_keys` | [`useSignInRedirectDecision.ts`](../apps/web/src/app/auth/sign-in/useSignInRedirectDecision.ts), [`CabinetOtherRolesBanner.tsx`](../apps/web/src/app/cabinet/components/CabinetOtherRolesBanner.tsx), [`post-signup/page.tsx`](../apps/web/src/app/auth/post-signup/page.tsx) |
| Страница бизнеса `/b/[slug]` и запись | `services`, `staff`, `service_staff`, `branches`, `branch_promotions`, `bookings`, `staff_schedule_rules`, RPC `get_free_slots_*` | [`useBookingData.ts`](../apps/web/src/app/b/[slug]/hooks/useBookingData.ts), [`useSlotsLoader.ts`](../apps/web/src/app/b/[slug]/hooks/useSlotsLoader.ts), [`useBookingSlotsState.ts`](../apps/web/src/app/b/[slug]/hooks/useBookingSlotsState.ts), [`BusinessInfo.tsx`](../apps/web/src/app/b/[slug]/BusinessInfo.tsx), [`bookingRescheduleClient.ts`](../apps/web/src/lib/bookingRescheduleClient.ts) |
| Кабинет бизнеса | `bookings`, `staff`, `service_staff`, `services`, `staff_schedule_rules`, RPC `dashboard_bookings_page`, `confirm_booking`, `cancel_booking` | [`useDashboardBookingsListController.ts`](../apps/web/src/app/dashboard/bookings/components/useDashboardBookingsListController.ts), [`BookingsViewSections.tsx`](../apps/web/src/app/dashboard/bookings/components/BookingsViewSections.tsx), [`useServiceStaffMap.ts`](../apps/web/src/app/dashboard/bookings/components/useServiceStaffMap.ts), [`ServiceMastersEditor.tsx`](../apps/web/src/app/dashboard/services/[id]/ServiceMastersEditor.tsx), [`StaffServicesEditor.tsx`](../apps/web/src/app/dashboard/staff/[id]/StaffServicesEditor.tsx), [`useStaffScheduleRules.ts`](../apps/web/src/app/dashboard/staff/[id]/schedule/useStaffScheduleRules.ts), [`TransfersTab.tsx`](../apps/web/src/app/dashboard/staff/[id]/schedule/TransfersTab.tsx), [`dashboardBookingsPage.ts`](../apps/web/src/lib/dashboardBookingsPage.ts), [`bookingDashboardService.ts`](../apps/web/src/lib/bookingDashboardService.ts) |
| Кабинет мастера | `staff_schedule_rules` | [`ViewSchedule.tsx`](../apps/web/src/app/staff/schedule/ViewSchedule.tsx) |
| Картинки | Фото мастеров (`avatar_url`) в обычном `<img>`, адрес `supabase.co` | [`BusinessInfo.tsx`](../apps/web/src/app/b/[slug]/BusinessInfo.tsx), [`StaffSelector.tsx`](../apps/web/src/app/b/[slug]/components/StaffSelector.tsx), [`BookingSummary.tsx`](../apps/web/src/app/b/[slug]/components/BookingSummary.tsx) |
| Realtime | Не используется | — |

### Серверные вызовы (Vercel → Supabase): блокировка их не касается

API-маршруты `src/app/api/**`, серверные страницы и [`middleware.ts`](../apps/web/src/middleware.ts) (обновляет сессию в cookie) обращаются к Supabase с серверов Vercel. Они работают из любой сети пользователя. Сюда же относятся вход через Яндекс (`/api/auth/yandex/*`), Telegram (`/api/auth/telegram/*`) и WhatsApp (`/api/auth/whatsapp/*`), загрузка и удаление фото, уведомления и cron.

### Где адрес Supabase «зашит»

- **Приложение:** `EXPO_PUBLIC_SUPABASE_URL` и значение по умолчанию в [`app.config.ts`](../apps/mobile/app.config.ts). Уже установленные сборки будут ходить на `supabase.co`, пока человек не обновит приложение.
- **Сайт:** `NEXT_PUBLIC_SUPABASE_URL` в Vercel и CSP в [`next.config.ts`](../apps/web/next.config.ts).
- **Имя сессии.** supabase-js называет хранилище сессии по адресу: `sb-<первая часть имени хоста>-auth-token`. Это проверено в `@supabase/supabase-js/dist/index.mjs`. Если просто сменить адрес клиента, приложение потеряет сохранённую сессию, а сайт — свою cookie. Пользователей выкинет из аккаунта, и сервер сайта перестанет видеть их сессию. Поэтому адрес нужно менять внутри `fetch`, а имя оставлять прежним (или явно задать `storageKey` и имя cookie).
- **Данные в базе:** `staff.avatar_url` хранит полный публичный адрес вида `https://beulnmftzbmtbdlgurht.supabase.co/storage/v1/object/public/avatars/...`. Его записывает [`staffAvatarUploadService.ts`](../apps/web/src/lib/staffAvatarUploadService.ts) (`getPublicUrl`). Другие адреса `supabase.co` в коде таблиц не найдены. Фото из Telegram (`telegram_photo_url`) лежат на серверах Telegram.
- **Google OAuth:** адрес возврата Google — `https://beulnmftzbmtbdlgurht.supabase.co/auth/v1/callback`. Его выдаёт сам Supabase, и через простой прокси его не поменять: после выбора аккаунта Google отправит браузер на `supabase.co`. Это так и для сайта, и для приложения. Сменить адрес возврата можно только своим доменом Supabase ([документация](https://supabase.com/docs/guides/platform/custom-domains)) или входом по ID-токену без перенаправления (см. шаг 3).
- **Apple (iOS):** нативный `signInWithIdToken` — обычный запрос к `/auth/v1/token`, адреса возврата нет. Через прокси работает.
- **Яндекс, Telegram, WhatsApp:** адреса возврата на `kezek.vercel.app`, на сервере. После входа браузер или приложение получает сессию, а дальше токен обновляется запросами в Supabase. Без прокси человек войдёт, но через час, когда токен истечёт, сессия перестанет обновляться.
- **Письма:** вход по email в приложении и на сайте — по коду (`verifyOtp`). Шаблон писем на проде агенты не видели. Если в нём есть ссылка `{{ .ConfirmationURL }}`, она ведёт на `supabase.co` — **не проверено**. Site URL и список адресов возврата уже на `kezek.vercel.app` ([DOMAIN_LOSS_RUNBOOK](DOMAIN_LOSS_RUNBOOK.md)).

## Варианты подробно

### A. Свой домен в Supabase (Custom Domain)

- **Как работает.** Supabase обслуживает API на вашем поддомене, например `api.<ваш-домен>`. В DNS добавляются CNAME на `beulnmftzbmtbdlgurht.supabase.co` и TXT-запись для сертификата. Старый адрес продолжает работать. После включения Auth сразу использует новый домен как адрес возврата OAuth, а публичные адреса файлов становятся `https://api.<домен>/storage/v1/...` ([документация](https://supabase.com/docs/guides/platform/custom-domains)).
- **Цена.** Нужен платный план: на Free своих доменов нет ([pricing](https://supabase.com/pricing)). Pro — от 25 $ в месяц, дополнение — 10 $ в месяц за домен ([цена дополнения](https://supabase.com/docs/guides/platform/manage-your-usage/custom-domains)). Pro и так нужен для бэкапов (пункт 14 в [OWNER_ACTIONS](OWNER_ACTIONS.md)), так что сверху выходит 10 $.
- **Поможет ли.** Раз CNAME ведёт на `*.supabase.co`, свой домен почти наверняка отвечает с тех же адресов Cloudflare. Supabase не называет Cloudflare на странице про домены, но их собственная [справка об ошибке 1016](https://supabase.com/docs/guides/troubleshooting/cloudflare-origin-error-1016-on-custom-domain-a57af4.md) показывает, что свои домены обслуживает Cloudflare. Выходит так: если блокируют адреса, домен не поможет; если блокируют имя `supabase.co`, поможет. В Индии Supabase советовал свои домены как обходной путь ([блог](https://supabase.com/blog/navigating-regional-network-blocks)). Какой тип блокировки у нас — **не проверено**.
- **Что меняется в коде.** Адрес клиента в приложении и на сайте; имя сессии зафиксировать, чтобы никого не разлогинило; CSP; заменить или переписывать при показе старые `avatar_url`.
- **Владелец.** Домен (пункт 1 в [OWNER_ACTIONS](OWNER_ACTIONS.md)). Supabase Pro. CNAME и TXT у регистратора. Добавить `https://api.<домен>/auth/v1/callback` в Google Cloud Console. Запустить `supabase domains create / reverify / activate` (или дать это сделать агенту под своим входом).
- **Усилие агентов:** около 1 дня. **Откат:** `supabase domains delete` и вернуть адрес в клиентах. Документация предупреждает, что после удаления сломается OAuth, если сначала не вернуть настройки провайдеров.

### B1. Прокси через сайт на Vercel (`/sb/*` → Supabase)

- **Как работает.** В `next.config.ts` добавляется правило: запросы `https://kezek.vercel.app/sb/<путь>` Vercel пересылает на `https://beulnmftzbmtbdlgurht.supabase.co/<путь>`. Vercel прямо называет это сценарием «проксировать запросы к API» ([rewrites](https://vercel.com/docs/rewrites)). `kezek.vercel.app` в «плохих» сетях открывается, и стоит он не на Cloudflare: адреса 216.198.79.131 и 64.29.17.131 в нашей проверке. Поэтому вариант работает при любом типе блокировки.
- **Что работает через прокси:** таблицы и RPC (PostgREST), вход по коду, Apple по ID-токену, обновление токенов, `setSession`, публичные файлы (фото).
- **Что не работает:**
  - Google OAuth в браузере: адрес возврата остаётся на `supabase.co` (см. выше), чиним шагом 3;
  - websocket (Realtime). Сейчас он не используется. Vercel поддерживает websocket только в своих функциях, и только в бете ([WebSockets](https://vercel.com/docs/functions/websockets)). Про websocket через внешние rewrites в документации ничего нет — **не проверено**.
- **Лимиты Vercel.**
  - Внешний сервер должен ответить за 120 секунд (Proxied request timeout на [странице лимитов](https://vercel.com/docs/limits)), для наших запросов этого хватает.
  - Ограничение тела запроса в 4,5 МБ относится к функциям Vercel ([лимиты функций](https://vercel.com/docs/functions/limitations)). Распространяется ли оно на внешние rewrites, в документации не сказано — **не проверено**. Большие файлы через прокси мы не грузим.
- **Важно для безопасности.**
  1. **Кеш.** Для проектов, созданных после 6 апреля 2026, Vercel по умолчанию кеширует ответы внешних rewrites по заголовкам источника ([rewrites](https://vercel.com/docs/rewrites)). Для `/sb/rest/` и `/sb/auth/` нужно явно выключить кеш заголовком `x-vercel-enable-rewrite-caching: 0`. Иначе личные данные одного человека могут попасть другому. Это блокер для внедрения: обязателен тест.
  2. **Только один адрес назначения.** Правило ведёт только на наш проект Supabase, а не на произвольный адрес.
  3. **Логи.** В журналах Vercel видны пути и параметры запросов. Нужно проверить, что телефоны и email не попадают в адрес запроса (фильтры PostgREST).
  4. **RLS и ключи не меняются:** прокси просто передаёт `apikey` и `Authorization`.
- **Общие лимиты входа по IP.** Для Supabase все пользователи прокси выглядят как несколько адресов Vercel. Лимиты Auth считаются по IP ([rate limits](https://supabase.com/docs/guides/auth/rate-limits)):
  - вход, отправка кода и `/user` — 30 запросов за 5 минут;
  - проверка кода — 30 за 5 минут;
  - выдача и обновление токенов — 150 за 5 минут.

  Для запуска в Оше с небольшим числом пользователей этого, скорее всего, хватит, но с ростом упрёмся. Лимиты можно поднять в панели Supabase. Передать настоящий IP можно заголовком `Sb-Forwarded-For`, но он требует секретного ключа — проксировать с ним небезопасно, нужен отдельный разбор. Распространяется ли лимит `/user` на частый `getUser` — **не проверено**.
- **Правила Vercel.** В разделе «Never fair use» правил честного использования есть пункт «Proxies and VPNs» ([fair use](https://vercel.com/docs/limits/fair-use-guidelines)). Скорее всего, имеется в виду общий прокси или VPN-сервис, а не прокси к своему API: этот сценарий есть в документации rewrites. Но формально риск есть — **не проверено** у Vercel. Тариф Vercel проекта агенты не видят: в [OPERATIONS](OPERATIONS.md) записан Pro. На Hobby коммерческое использование запрещено в любом случае.
- **Цена.**
  - Трафик идёт через CDN Vercel (Fast Data Transfer) и между Vercel и Supabase (Fast Origin Transfer), оба по региональным ценам ([fair use](https://vercel.com/docs/limits/fair-use-guidelines), [regional pricing](https://vercel.com/docs/pricing/regional-pricing)).
  - На Hobby включено 100 ГБ и 10 ГБ соответственно; на Pro трафик CDN входит в фиксированную цену, а Origin Transfer оплачивается по использованию.
  - Наши ответы — небольшие JSON и фото мастеров, поэтому оценка — 0–5 $ в месяц на старте (оценка, не по счёту). Исходящий трафик Supabase остаётся тем же.
- **Что меняется в коде.**
  - **Сайт:** в `createBrowserClient` передать свой `fetch`, который меняет `https://<ref>.supabase.co/` на `https://kezek.vercel.app/sb/`. Адрес клиента остаётся прежним, поэтому имя cookie не меняется и сервер дальше видит сессию. Запросы становятся «своими» для сайта, CSP не трогаем.
  - **Приложение:** то же в [`supabaseFetch.ts`](../apps/mobile/src/lib/supabaseFetch.ts); адрес прокси — новая переменная `EXPO_PUBLIC_SUPABASE_PROXY_URL`.
  - **Фото:** при показе переписывать адрес `avatar_url` на прокси одной функцией; базу не трогаем.
  - **Проверить при реализации:** доходит ли собственный `fetch` до клиента Auth в `@supabase/ssr` и supabase-js (по устройству библиотеки — да, но в коде не проверено).
- **Владелец:** ничего настраивать не нужно; для приложения нужна новая сборка (пункт 16 в [OWNER_ACTIONS](OWNER_ACTIONS.md)).
- **Усилие агентов:** около 2 дней с тестами. **Откат:** выключить переменную и сделать redeploy (или мгновенный откат деплоя в Vercel). В приложении прокси держим за флагом с возвратом на прямой адрес, если прокси не ответил.

### B2. Cloudflare Worker

- **Как работает.** Маленький скрипт на `*.workers.dev` или на своём домене пересылает запросы в Supabase, включая websocket. Такой обход описан для блокировки в Индии ([пример](https://dev.to/ritvikdayal/supabase-is-blocked-in-india-heres-the-exact-fix-using-a-cloudflare-worker-2ejf)).
- **Цена:** бесплатно до 100 000 запросов в день; платный план — 5 $ в месяц за 10 млн запросов; за трафик Cloudflare денег не берёт ([pricing](https://developers.cloudflare.com/workers/platform/pricing/)).
- **Поможет ли.** Worker отвечает с адресов Cloudflare. Если у провайдера закрыты только конкретные адреса Supabase, другие адреса Cloudflare могут работать. Если закрыты подсети Cloudflare целиком, не поможет. Наши адреса (8.6.112.0, 8.47.69.0) — подсети Cloudflare. **Не проверено**, проверяется шагом 0.
- **Ограничения:** Google OAuth и общие лимиты по IP — как в B1. Нужен аккаунт Cloudflare владельца. Код выкладывает владелец, или агент с токеном, который владелец создаёт и вводит сам.
- **Усилие агентов:** 1–2 дня. **Откат:** вернуть прямой адрес.

### B3. Свой сервер (VPS) с nginx

- **Как работает.** Арендуется сервер, например Hetzner CX23: около 6 € в месяц с IPv4 по [обзору цен 2026](https://betterstack.com/community/guides/web-servers/hetzner-cloud-review/); актуальную цену смотреть на [странице Hetzner](https://www.hetzner.com/cloud/cost-optimized). nginx пересылает всё, включая websocket. Нужен свой домен для сертификата.
- **Плюс:** свой IP вне Cloudflare и полный контроль.
- **Минусы:**
  - обновления, сертификаты, мониторинг и падения — на нас, а у проекта нет администратора;
  - один сервер — одна точка отказа;
  - IP сервера тоже могут заблокировать;
  - Google OAuth и общие лимиты по IP — как в B1.
- **Усилие агентов:** 2 дня и постоянное обслуживание. **Откат:** вернуть прямой адрес.

### C. Все данные через API сайта

- **Объём.** В приложении прямые чтения и записи остаются примерно в 25 файлах, на сайте — примерно в 20 клиентских файлах (таблицы выше). Для каждого нужен маршрут API с проверкой бизнеса, контракт в `docs/api/*.md`, тесты и правка экрана: **8–12 дней**.
- **Главное ограничение.** Вход и обновление токенов всё равно идут в Supabase, поэтому этот вариант без прокси для `/auth/v1/` не решает задачу.
- **Где полезен:** там, где перевод на API нужен и так — единые правила для сайта и приложения, меньше логики в клиенте. Делать постепенно и не как способ обойти блокировку.
- **Откат:** по каждому экрану отдельно.

## Рекомендация

1. **Сначала узнать, что именно блокируется** (шаг 0). Это бесплатно и сразу показывает, стоит ли платить за свой домен Supabase.
2. **Основное решение — прокси через Vercel (B1).** Только про `kezek.vercel.app` известно, что он открывается в «плохих» сетях. Он не на Cloudflare, отдельной платы почти нет, и владельцу ничего настраивать не нужно. Адрес меняется внутри `fetch`, поэтому сессии и cookie не ломаются.
3. **Вход через Google — без перехода на `supabase.co`:** на сайте кнопка Google Identity Services, на Android нативный вход Google, в обоих случаях дальше `signInWithIdToken`. Это рекомендует сама [документация Supabase](https://supabase.com/docs/guides/auth/social-login/auth-google). Без этого вход через Google в «плохих» сетях не заработает ни с каким прокси, кроме своего домена Supabase.
4. **Свой домен Supabase (A) — только если** шаг 0 покажет, что блокируется имя, а не адреса, и когда будут домен и Pro. Тогда OAuth заработает и через обычный адрес возврата, а прокси можно будет убрать.
5. **Worker и VPS — запасные варианты**, если Vercel начнёт возражать против прокси или понадобится Realtime.

## Порядок внедрения

1. **Шаг 0 — проверочная страница (агенты, 0,5 дня; владелец, 10 минут).** Страница на `kezek.vercel.app` с браузера пробует:
   - прямой адрес Supabase (`/auth/v1/health`);
   - тот же запрос через `/sb/` (после шага 1);
   - тестовый Worker на `workers.dev`, если владелец заведёт Cloudflare;
   - любой другой сайт на Cloudflare.

   Страница показывает «работает / не работает» и время ответа. Владелец открывает её с телефона в «плохой» сети (мобильный интернет и Wi-Fi того провайдера) и присылает снимок экрана. Второй тест: включить на Android «Частный DNS» (`dns.google`) и повторить. Если с ним Supabase открывается — блокировка по DNS, и свой домен (A) поможет.
2. **Шаг 1 — прокси на Vercel для сайта (агенты, 1 день).**
   - Rewrite `/sb/*` без кеша для `rest` и `auth`.
   - Подмена адреса в `fetch` браузерного клиента и фото через прокси.
   - Тесты: правило не кеширует, назначение фиксировано, cookie сессии прежняя.

   Сразу после деплоя сайт работает в «плохих» сетях, кроме входа через Google. Проверка — снова шаг 0 и запись в «Тестовый бизнес» с телефона в «плохой» сети.
3. **Шаг 2 — то же в приложении (агенты, 1 день).** Подмена в [`supabaseFetch.ts`](../apps/mobile/src/lib/supabaseFetch.ts) за флагом, возврат на прямой адрес при ошибке прокси, фото через прокси. Попадёт к людям с первой новой сборкой EAS после 1 декабря (пункт 16 в [OWNER_ACTIONS](OWNER_ACTIONS.md)). Старые сборки останутся без прокси.
4. **Шаг 3 — Google по ID-токену (агенты, 2–3 дня; владелец, 30 минут).** Сайт: кнопка Google Identity Services. Android: нативная библиотека входа Google. Владелец создаёт в Google Cloud Console Android-клиент OAuth (отпечаток ключа из EAS) и добавляет его Client ID в Supabase → Google. Старый вход через браузер оставить запасным.
5. **Шаг 4 — наблюдение (агенты).** Неделю смотреть в Supabase на ошибки 429 (лимиты Auth) и в Vercel — на трафик External Origins. Если упираемся в лимиты, поднять их в панели Supabase.
6. **Шаг 5 — после покупки домена (по желанию).** Если шаг 0 показал блокировку по DNS — свой домен Supabase (A), и прокси можно снять. Если по адресам — оставить прокси, перенеся его на `api.<домен>` в Vercel.

**Как проверять из «плохой» сети без технических знаний:** страница шага 0, затем вход по коду, страница бизнеса, выбор слота и запись в «Тестовый бизнес 1» на сайте и в новой сборке приложения. Ориентир — снимок экрана с временем.

## Попутно найдено

- Фото мастера принимается до 5 МБ ([`staffAvatar.ts`](../apps/mobile/src/lib/staffAvatar.ts)), а функции Vercel по умолчанию принимают тело запроса до 4,5 МБ ([лимиты функций](https://vercel.com/docs/functions/limitations)). Фото от 4,5 до 5 МБ, скорее всего, получают ошибку 413. На проде не проверено.
