# Kezek: store listings and launch copy

Status: draft for the owner, 28 November 2026. Prepared by the marketing role; nothing is published.
The owner publishes in Google Play Console and App Store Connect.

Scope: the mobile app in `apps/mobile` (Expo, package/bundle `kg.kezek.app`), roles client, master
(staff) and business owner/manager. Super-admin is web-only and is not mentioned. Every claim was
checked against the app's screens and dictionaries; see [Claims to fact-check](#claims-to-fact-check)
before publishing.

Copy rules applied: no payment wording (the app takes no payments), money in «сом» / «som», Russian
addresses the reader as «вы» and uses «ё», English uses «Business dashboard», «Staff workspace»,
«My account». No numbers, ratings or testimonials that we cannot prove. The address is
https://kezek.vercel.app (never kezek.kg).

Character counts below were produced by a script (`[...text].length`, i.e. Unicode code points;
line breaks count as one character each). Format: `count / limit`.

## Contents

- [Russian (ru)](#russian-ru)
- [Kyrgyz (ky) — needs native-speaker review](#kyrgyz-ky--needs-native-speaker-review)
- [English (en)](#english-en)
- [Categories](#categories)
- [Screenshot shot-list](#screenshot-shot-list)
- [Claims to fact-check](#claims-to-fact-check)
- [Needed from the owner](#needed-from-the-owner)
- [Проверка фактов (28.11.2026)](#проверка-фактов-28112026)

## Two decisions to take before pasting

1. **Push notifications.** The app has the «Push-уведомления» switch and the server sends push, but
   delivery needs the owner's FCM key (Android, `docs/OWNER_ACTIONS.md` row 9 — not set on
   28.11.2026) and APNs key (iOS) in the release build. The full descriptions below therefore use the
   **Telegram-only** notifications bullet. The push variant is kept next to each description as a
   commented alternative: swap it in only after push has been seen arriving on a phone from the build
   you publish.
2. **Sign-in methods.** The copy says only «вход без пароля» and does not list methods, because WhatsApp
   sign-in depends on a server secret and Sign in with Apple is still being added for iOS. Once both
   are confirmed you may name them (Google, Telegram, WhatsApp, Apple on iOS).

---

## Russian (ru)

### Google Play (ru-RU)

App name:

```text
Kezek — запись в салоны Оша
```
Count: 27 / 30

Short description:

```text
Запись к мастерам Оша без звонков: услуги, цены и свободное время
```
Count: 65 / 80

Full description (the same text is used as the App Store description):

```text
Kezek — онлайн-запись в салоны красоты, барбершопы и студии Оша. Выберите услугу, мастера и свободное время — без звонков и переписок.

ДЛЯ КЛИЕНТОВ
• Каталог бизнесов Оша: поиск по названию или адресу, популярные категории, ближайшие филиалы и карта.
• Страница бизнеса: филиалы, услуги с ценами в сомах и длительностью, команда, действующие акции, ссылки на Instagram, 2ГИС и карты.
• Запись в несколько шагов: филиал, одна или несколько услуг, мастер или «Любой мастер», дата и свободное время.
• Можно записаться без регистрации — достаточно имени и телефона. Записывайтесь после входа, и все записи и история визитов будут в личном кабинете.
• До начала визита запись можно отменить прямо в приложении, а подтверждённую — перенести (запись с акцией или пакетом переносит салон).
• Повторная запись в одно касание, звонок в салон, сообщение в WhatsApp, маршрут на карте.
• Подтверждения и напоминания о визите — в Telegram, если подключить его в профиле.
• Оценка и отзыв после визита. Ваши пакеты визитов: сколько осталось и до какого числа действуют.
• Вход без пароля. Приложение на русском, кыргызском и английском языках.

ДЛЯ МАСТЕРОВ
• Кабинет сотрудника: предстоящие и прошедшие записи, звонок клиенту или сообщение в WhatsApp.
• Ваш график на текущую и следующую неделю.
• Запишите клиента на свои услуги прямо из приложения.
• «Моя смена»: откройте смену, добавляйте клиентов и суммы, закройте смену в конце дня. Без интернета изменения сохранятся и отправятся, когда связь вернётся.
• Смены и статистика за день, месяц и год: клиенты, ваша доля.
• Работаете в нескольких бизнесах — переключайтесь между ними. Приглашение в команду принимается в приложении.

ДЛЯ ВЛАДЕЛЬЦЕВ И УПРАВЛЯЮЩИХ
• Кабинет бизнеса: календарь дня по мастерам, список записей с фильтрами, быстрая запись клиента на стойке.
• Подтверждайте записи, отмечайте приход или неявку, отменяйте.
• Филиалы с адресом на карте и графиком работы, услуги и мастера, которые их выполняют, акции филиала.
• Сотрудники: графики, отсутствия, временный перевод в другой филиал, доля от выручки и ставка.
• Финансы по сменам и сотрудникам. Аналитика: записи, конверсия, выручка, загрузка по часам, доля акций.
• Пакеты визитов: создавайте и оформляйте клиентам.
• Рейтинг бизнеса, филиалов и сотрудников в Kezek и отзывы клиентов.
• Подключите бизнес заявкой из приложения: после проверки он будет привязан к вашему аккаунту.

Kezek работает и на сайте: kezek.vercel.app
```
Count: 2438 / 4000

The notifications bullet above is the no-push version. Push alternative (do not publish until push
is verified on a device):

<!-- PUSH VARIANT (gate: FCM/APNs keys in the build + BOOKING_NOTIFICATION_WORKER_ENABLED=true):
• Подтверждения и напоминания о визите — push-уведомлением или в Telegram.
Count: 74 (replaces one line; the full text stays under the limit)
-->

What's new:

```text
Первая версия Kezek в Google Play.
• Каталог салонов и студий Оша, карта и поиск рядом.
• Онлайн-запись к мастеру, перенос и отмена записи.
• Кабинет сотрудника: записи, график, смена и статистика.
• Кабинет бизнеса: календарь, сотрудники, услуги, акции и аналитика.
• Русский, кыргызский и английский языки.
```
Count: 308 / 500

### App Store (ru)

Name:

```text
Kezek: запись в салоны Оша
```
Count: 26 / 30

Subtitle:

```text
К мастеру без звонков
```
Count: 21 / 30

Promotional text:

```text
Салоны, барбершопы и студии Оша в одном приложении: услуги с ценами, свободное время мастеров и запись в несколько касаний. Перенести или отменить — тоже здесь.
```
Count: 160 / 170

Description: the [full description above](#google-play-ru-ru) (2438 / 4000).

Keywords (comma-separated, no spaces, no words from the name «Kezek», «запись», «салоны», «Оша» — so no «Ош» either):

```text
маникюр,барбершоп,стрижка,парикмахерская,брови,ресницы,косметолог,мастер,красота,бронь,онлайн
```
Count: 93 / 100, 11 keywords, 176 UTF-8 bytes

What's New (Apple shows it only from the second version; keep it for 1.0.1+):

```text
Первая версия Kezek в App Store: каталог салонов Оша, онлайн-запись, перенос и отмена записи, кабинет сотрудника и кабинет бизнеса. Русский, кыргызский и английский языки.
```
Count: 171 / 4000

---

## Kyrgyz (ky) — needs native-speaker review

**Needs native-speaker review.** Written to read naturally, but it must be checked by a native Kyrgyz
speaker before publishing. The app's own Kyrgyz UI calls a master «кызматкер»; the marketing copy
uses «чебер» where it reads more naturally and keeps the in-app names of screens («Бизнес
кабинети», «Кызматкердин кабинети», «Менин сменам»).

App Store Connect has no Kyrgyz localization at the time of writing (fact-check item 20); the App Store
block is provided in case it appears, or for reuse on the site and in social posts.

### Google Play (ky-KG)

App name:

```text
Kezek — салонго жазылуу
```
Count: 23 / 30

Short description:

```text
Оштогу чеберлерге чалуусуз жазылуу: кызматтар, баалар жана бош убакыт
```
Count: 69 / 80

Full description:

```text
Kezek — Ош шаарындагы сулуулук салондоруна, барбершопторго жана студияларга онлайн жазылуу. Кызматты, чеберди жана бош убакытты тандаңыз — чалуусуз жана кат алышуусуз.

КАРДАРЛАР ҮЧҮН
• Оштогу бизнестердин каталогу: аталышы же дареги боюнча издөө, популярдуу категориялар, жакынкы филиалдар жана карта.
• Бизнестин баракчасы: филиалдар, баасы (сом менен) жана узактыгы жазылган кызматтар, команда, учурдагы акциялар, Instagram, 2ГИС жана карталарга шилтемелер.
• Бир нече кадам менен жазылуу: филиал, бир же бир нече кызмат, чебер же «Ар кандай кызматкер», күн жана бош убакыт.
• Катталбай деле жазылса болот — атыңыз жана телефонуңуз жетиштүү. Аккаунтка кирип жазылсаңыз, бардык жазылуулар жана визиттердин тарыхы жеке кабинетте болот.
• Визит башталганга чейин жазылууну колдонмонун ичинде эле жокко чыгарсаңыз, ал эми ырасталганын жылдырсаңыз болот (акция же пакет менен жазылууну салон жылдырат).
• Бир басуу менен кайра жазылуу, салонго чалуу, WhatsApp аркылуу жазуу, картадан жол табуу.
• Визит тууралуу ырастоо жана эскертүү — Telegram аркылуу, аны профилде туташтырсаңыз.
• Визиттен кийин баа жана пикир калтыруу. Визит пакеттериңиз: канча визит калганы жана качанга чейин жарактуу экени.
• Сыр сөзсүз кирүү. Колдонмо орус, кыргыз жана англис тилдеринде.

ЧЕБЕРЛЕР ҮЧҮН
• Кызматкердин кабинети: алдыдагы жана өткөн жазылуулар, кардарга чалуу же WhatsApp аркылуу жазуу.
• Ушул жана кийинки жумадагы графигиңиз.
• Кардарды өз кызматтарыңызга колдонмодон түз жазыңыз.
• «Менин сменам»: сменаны ачыңыз, кардарларды жана сумманы кошуңуз, күндүн аягында сменаны жабыңыз. Интернет жок болсо, өзгөртүүлөр сакталып, байланыш калыбына келгенде жөнөтүлөт.
• Күн, ай жана жыл боюнча сменалар жана статистика: кардарлар, сиздин үлүшүңүз.
• Бир нече бизнесте иштесеңиз — алардын ортосунда которулуңуз. Командага чакырууну колдонмодон кабыл аласыз.

ЭЭЛЕРИ ЖАНА МЕНЕДЖЕРЛЕР ҮЧҮН
• Бизнес кабинети: чеберлер боюнча күндүн календары, чыпкалары бар жазылуулар тизмеси, стойкада кардарды тез жазуу.
• Жазылууларды ырастаңыз, келгенин же келбегенин белгилеңиз, жокко чыгарыңыз.
• Дареги картада белгиленген, иш графиги бар филиалдар, кызматтар жана аларды аткарган чеберлер, филиалдын акциялары.
• Кызматкерлер: графиктер, жок болгон күндөр, башка филиалга убактылуу которуу, кирешедеги үлүш жана ставка.
• Сменалар жана кызматкерлер боюнча каржы. Аналитика: жазылуулар, конверсия, киреше, сааттар боюнча жүктөм, акциялардын үлүшү.
• Визит пакеттери: түзүңүз жана кардарларга тариздеңиз.
• Kezek'теги бизнестин, филиалдардын жана кызматкерлердин рейтинги, кардарлардын пикирлери.
• Бизнесиңизди колдонмодон арыз берип кошуңуз: текшерүүдөн кийин ал аккаунтуңузга байланат.

Kezek сайтта да иштейт: kezek.vercel.app
```
Count: 2701 / 4000

The notifications bullet above is the no-push version. Push alternative (do not publish until push
is verified on a device):

<!-- PUSH VARIANT (gate: FCM/APNs keys in the build + BOOKING_NOTIFICATION_WORKER_ENABLED=true):
• Визит тууралуу ырастоо жана эскертүү — push-билдирме же Telegram аркылуу.
Count: 75 (replaces one line)
-->

What's new:

```text
Kezek'тин Google Play'деги биринчи версиясы.
• Оштогу салондор жана студиялар каталогу, карта жана жакындан издөө.
• Чеберге онлайн жазылуу, жазылууну жылдыруу жана жокко чыгаруу.
• Кызматкердин кабинети: жазылуулар, график, смена жана статистика.
• Бизнес кабинети: календарь, кызматкерлер, кызматтар, акциялар жана аналитика.
• Орус, кыргыз жана англис тилдери.
```
Count: 363 / 500

### App Store (ky, if a Kyrgyz localization becomes available)

Name:

```text
Kezek: Оштогу салондорго кезек
```
Count: 30 / 30

Subtitle:

```text
Чеберге чалуусуз жазылуу
```
Count: 24 / 30

Promotional text:

```text
Оштогу салондор, барбершоптор жана студиялар бир колдонмодо: баасы менен кызматтар, чеберлердин бош убактысы жана бир нече басуу менен жазылуу.
```
Count: 143 / 170

Description: the [full description above](#google-play-ky-kg) (2701 / 4000).

Keywords (no words from the name «Kezek», «Оштогу», «салондорго», «кезек»):

```text
маникюр,барбершоп,чач,чачтарач,каш,кирпик,косметолог,чебер,сулуулук,жазылуу,онлайн,Кыргызстан
```
Count: 93 / 100, 12 keywords, 175 UTF-8 bytes

What's New (from the second version):

```text
Kezek'тин App Store'догу биринчи версиясы: Оштогу салондор каталогу, онлайн жазылуу, жазылууну жылдыруу жана жокко чыгаруу, кызматкердин кабинети жана бизнес кабинети. Орус, кыргыз жана англис тилдери.
```
Count: 201 / 4000

---

## English (en)

### Google Play (en-US)

App name:

```text
Kezek: Osh salon booking
```
Count: 24 / 30

Short description:

```text
Book salons and masters in Osh without calls: services, prices and free times
```
Count: 77 / 80

Full description (also the App Store description):

```text
Kezek is online booking for beauty salons, barbershops and studios in Osh. Pick a service, a master and a free time — no calls, no back-and-forth messages.

FOR CLIENTS
• A catalogue of businesses in Osh: search by name or address, popular categories, nearby branches and a map.
• Business pages: branches, services with prices in som and durations, the team, current promotions, links to Instagram, 2GIS and maps.
• Book in a few steps: branch, one or several services, a master or «Any master», date and a free time.
• Book without registering — a name and a phone number are enough. Book while signed in and every booking and past visit stays in My account.
• Cancel a booking in the app before the visit starts, or reschedule a confirmed one (a booking with a promotion or package is rescheduled by the salon).
• Book again in one tap, call the salon, message it on WhatsApp, get directions on the map.
• Booking confirmations and reminders in Telegram once you connect it in your profile.
• Rate your visit and leave a review. See your visit packages: visits left and the expiry date.
• Passwordless sign-in. The app speaks Russian, Kyrgyz and English.

FOR MASTERS
• Staff workspace: upcoming and past bookings, call a client or message them on WhatsApp.
• Your schedule for this week and next.
• Book a client for your own services right from the app.
• My shift: open the shift, add clients and amounts, close it at the end of the day. Offline changes are saved and sent once you are back online.
• Shifts and statistics by day, month and year: clients and your share.
• Work for several businesses? Switch between them. Accept a team invitation in the app.

FOR OWNERS AND MANAGERS
• Business dashboard: a day calendar by master, a filtered booking list and quick booking at the front desk.
• Confirm bookings, mark arrivals or no-shows, cancel.
• Branches with a map location and opening hours, services and the masters who do them, branch promotions.
• Staff: schedules, absences, temporary transfers to another branch, revenue share and rate.
• Finance by shift and by employee. Analytics: bookings, conversion, revenue, load by hour, promotions' share.
• Visit packages: create them and issue them to clients.
• Kezek ratings for the business, branches and staff, and client reviews.
• Connect your business with an application in the app: once it is approved, the business is linked to your account.

Kezek also works on the web: kezek.vercel.app
```
Count: 2460 / 4000

The notifications bullet above is the no-push version. Push alternative (do not publish until push
is verified on a device):

<!-- PUSH VARIANT (gate: FCM/APNs keys in the build + BOOKING_NOTIFICATION_WORKER_ENABLED=true):
• Booking confirmations and reminders by push notification or in Telegram.
Count: 74 (replaces one line)
-->

What's new:

```text
The first version of Kezek on Google Play.
• A catalogue of salons and studios in Osh, a map and nearby search.
• Online booking with a master, rescheduling and cancelling.
• Staff workspace: bookings, schedule, shift and statistics.
• Business dashboard: calendar, staff, services, promotions and analytics.
• Russian, Kyrgyz and English.
```
Count: 339 / 500

### App Store (en-US)

Name:

```text
Kezek: Osh salon booking
```
Count: 24 / 30

Subtitle:

```text
Book a master without calls
```
Count: 27 / 30

Promotional text:

```text
Salons, barbershops and studios in Osh in one app: services with prices, masters' free times and booking in a few taps. Reschedule or cancel right here too.
```
Count: 156 / 170

Description: the [full description above](#google-play-en-us) (2460 / 4000).

Keywords (no words from the name «Kezek», «Osh», «salon», «booking»):

```text
barber,haircut,nails,manicure,brows,lashes,beauty,stylist,appointment,schedule,Kyrgyzstan,master
```
Count: 96 / 100, 12 keywords, 96 UTF-8 bytes

What's New (from the second version):

```text
The first version of Kezek on the App Store: a catalogue of salons in Osh, online booking, rescheduling and cancelling, Staff workspace and Business dashboard. Russian, Kyrgyz and English.
```
Count: 188 / 4000

---

## Categories

| Store | Primary | Secondary | Why |
| --- | --- | --- | --- |
| Google Play | **Beauty** (Красота) | — (Play has one category; tags: «Beauty salons», «Appointments» if offered) | Clients searching for a salon or master are the main audience; Play has a dedicated Beauty category |
| App Store | **Lifestyle** | **Business** | The App Store has no Beauty category; Lifestyle is where salon booking apps sit, Business covers the Staff workspace and Business dashboard |

Content rating questionnaire: no violence, no user-to-user chat, no gambling, no purchases in the app.
Reviews are free text visible only to the business owner (`cabinet.review.commentHint`).

---

## Screenshot shot-list

General rules for all shots:

- Data only from «Тестовый бизнес 1» / «Тестовый бизнес 2». Client and master names are made up
  (for example «Айгерим», «Бакыт», «Нурлан»), phone numbers in the form `+996 555 000 001`. No real
  people, photos or phone numbers. Master photos only if the person consented, otherwise the default
  avatar.
- The app's UI is dark (`userInterfaceStyle: dark`). Shoot each locale in its own UI language (switch
  language in the profile); captions go above the phone frame.
- Times in the house style: «27 нояб. • 19:00», ranges «10:00–11:00», prices «1 200 сом».
- Statuses only as in the app: «В ожидании / Подтверждено / Выполнено / Отменено / Не пришёл»
  (ky «Күтүүдө / Ырасталган / Аткарылган / Жокко чыгарылган / Келген жок»; en as in the app). Never
  «Оплачено / Paid».
- Sizes: Google Play phone screenshots (2–8, 16:9 or 9:16); App Store 6.9" iPhone set, and an iPad 13"
  set because `ios.supportsTablet` is `true` in `app.json`.
- Suggested order in the store: client 1–5 first (most downloads are clients), then master 1–2 and
  owner 1–3; the full per-role sets below are for the site and social posts.

### Client

| # | Screen (file) | State and data to show | Caption ru | Caption ky | Caption en |
| --- | --- | --- | --- | --- | --- |
| C1 | Home (`screens/HomeScreen.tsx`) | Hero «Найдите свой сервис», category chips, list with «Тестовый бизнес 1» and «2», signed in so «Ближайшие записи» shows one confirmed booking | Салоны Оша в одном приложении | Оштогу салондор бир колдонмодо | Osh salons in one app |
| C2 | Business page (`screens/business/BusinessScreen.tsx`) | «Тестовый бизнес 1»: services with prices in сом and minutes, team, one active promotion | Услуги, цены и мастера — заранее | Кызматтар, баалар жана чеберлер — алдын ала | Services, prices and masters up front |
| C3 | Booking, time step (`screens/booking/BookingStep5Time.tsx`) | A Monday with several free slots (Тестовый бизнес 2 branch is open on Mondays), one slot selected | Свободное время сразу видно | Бош убакыт дароо көрүнөт | See free times at a glance |
| C4 | Booking, confirmation (`screens/booking/BookingStep6Confirm.tsx`) | Branch, service, master, «27 нояб. • 19:00», price in сом, button «Подтвердить» | Проверьте и запишитесь | Текшерип, жазылыңыз | Check and book |
| C5 | Booking details (`screens/BookingDetailsScreen.tsx`) | A future booking with status «Подтверждено» and **no promotion or visit package** (otherwise «Перенести запись» is hidden and the «Оплачено пакетом» line appears), buttons «Перенести запись», «Отменить запись», «Маршрут» | Перенести или отменить — в пару касаний | Жылдыруу же жокко чыгаруу — эки басуу менен | Reschedule or cancel in a couple of taps |
| C6 | Branch map (`screens/MapScreen.tsx`) | Map of Osh with test branch pins | Филиалы рядом на карте | Жакынкы филиалдар картада | Nearby branches on the map |

### Master (Staff workspace)

| # | Screen (file) | State and data to show | Caption ru | Caption ky | Caption en |
| --- | --- | --- | --- | --- | --- |
| M1 | Staff workspace (`screens/StaffScreen.tsx`) | «Предстоящие» tab, 3–4 bookings with statuses «Подтверждено» and «В ожидании», made-up client names | Все ваши записи под рукой | Бардык жазылууларыңыз колуңузда | All your bookings at hand |
| M2 | My schedule (`screens/StaffScheduleScreen.tsx`) | «Текущая неделя», working days with hours «10:00–19:00», one break, one day off | Ваш график на две недели | Эки жумалык графигиңиз | Your schedule for two weeks |
| M3 | My shift (`screens/ShiftQuickScreen.tsx`) | «Смена активна», 3 clients with service and amount in сом, shift metrics | Смена: клиенты и суммы за день | Смена: күндүн кардарлары жана суммалары | Your shift: clients and amounts |
| M4 | Shifts and statistics (`screens/ShiftsScreen.tsx`) | Period «Месяц», shifts count, clients, staff share | Статистика за день, месяц и год | Күн, ай жана жыл боюнча статистика | Stats by day, month and year |
| M5 | Create booking (`screens/StaffCreateBookingScreen.tsx`) | «Мои услуги» with the master's own services, a free time selected | Запишите клиента сами | Кардарды өзүңүз жазыңыз | Book a client yourself |

### Owner / manager (Business dashboard)

| # | Screen (file) | State and data to show | Caption ru | Caption ky | Caption en |
| --- | --- | --- | --- | --- | --- |
| O1 | Overview (`screens/manage/overview/ManageOverviewScreen.tsx`) | «Тестовый бизнес 1», quick actions, «Рейтинг бизнеса в Kezek» card | Кабинет бизнеса в телефоне | Бизнес кабинети телефонуңузда | Your Business dashboard in your pocket |
| O2 | Bookings, day calendar (`screens/manage/bookings/BookingsCalendarTab.tsx`) | One day, 2–3 masters, bookings in different statuses | День салона по мастерам | Салондун күнү чеберлер боюнча | The salon's day by master |
| O3 | Quick desk (`screens/manage/bookings/QuickDeskTab.tsx`) | Walk-in form filled with a made-up client, service and time | Быстрая запись на стойке | Стойкада тез жазуу | Quick booking at the front desk |
| O4 | Staff schedule (`screens/manageStaff/ManageStaffScheduleScreen.tsx`) | A week with hours, one absence | Графики и отсутствия сотрудников | Кызматкерлердин графиги жана жок болгон күндөрү | Staff schedules and absences |
| O5 | Analytics (`screens/manage/analytics/ManageAnalyticsScreen.tsx`) | «30 дней», KPI cards and «Загрузка по часам» filled from test bookings (needs calculated statistics) | Записи, выручка и часы пик | Жазылуулар, киреше жана эң жүктүү сааттар | Bookings, revenue and peak hours |
| O6 | Services (`screens/manage/catalog/ServicesScreen.tsx`) or visit packages (`screens/manage/visitPackages/ManageVisitPackagesScreen.tsx`) | Several services with prices in сом and durations | Услуги, акции и пакеты визитов | Кызматтар, акциялар жана визит пакеттери | Services, promotions and visit packages |

---

## Claims to fact-check

Each claim used in the copy, with the file it is based on. Items marked **gate** must be confirmed
before publishing; the rest were confirmed in code and need only a look in the release build.

| # | Claim | Based on | Note |
| --- | --- | --- | --- |
| 1 | **gate** Confirmations and reminders by push | `apps/mobile/src/screens/profile/PushNotificationsSwitch.tsx`, `src/i18n/dictionaries/push.ru.ts`, `apps/web/src/lib/notifications/README.md` («Push в мобильном приложении»), `docs/OWNER_ACTIONS.md` (push section) | Code and the `push_tokens` migration exist; delivery needs FCM V1 (Android) and APNs (iOS) keys in a new EAS build and `BOOKING_NOTIFICATION_WORKER_ENABLED=true`. Push on a device was not verified; the FCM key is not set (OWNER_ACTIONS row 9). Published copy uses the no-push bullet; the push variant is a commented alternative |
| 2 | **gate** Confirmations and reminders in Telegram | `apps/web/src/lib/notifications/README.md` (reminders 24 h and 2 h before), `src/screens/profile/TelegramLinkSheet.tsx`, `cabinet.profile.telegram.*` | Client must link Telegram in the profile (linking opens the website). Reminders go only for confirmed bookings. Nothing is sent unless `BOOKING_NOTIFICATION_WORKER_ENABLED=true` in Vercel (OWNER_ACTIONS row 17, unknown on 28.11.2026); Telegram login/linking also needs the bot domain moved to kezek.vercel.app (row 4) |
| 3 | WhatsApp booking notifications are **not** claimed | `docs/OWNER_ACTIONS.md` (R25-07), memory: templates pending in Meta | Do not add until templates are approved and Vercel vars set. «Сообщение в WhatsApp» in the copy is only opening WhatsApp to the salon/client (`cabinet.details.whatsapp`, `staff.contact.whatsapp`) |
| 4 | E-mail notifications are **not** claimed | memory: e-mail domain lost | Profile has the e-mail switch (`cabinet.profile.notifications.email`), but sending depends on `EMAIL_FROM` |
| 5 | **gate** «Вход без пароля» (methods not listed) | `src/screens/auth/SignInScreen.tsx`, `src/screens/auth/hooks/authFeatureFlags.ts`, `auth.ru.ts` | Google, Telegram and WhatsApp code are in the app. WhatsApp needs `WHATSAPP_OTP_HASH_SECRET` in Vercel (`docs/OWNER_ACTIONS.md` §2). Sign in with Apple is being added; App Store review requires it when Google sign-in is offered |
| 6 | Booking without registration (name + phone) | `src/screens/booking/BookingGuestForm.tsx`, `booking.guest.*` | A guest booking is not attached to an account created later (no linking code found), so the copy says «записывайтесь после входа» rather than «войдите, и все записи сохранятся» |
| 7 | Browsing the catalogue without an account | `src/navigation/RootNavigator.tsx` (comment «need no account»), `discovery.ru.ts` | — |
| 8 | Search by name or address, categories, nearby branches (20 km), map | `src/screens/home/SearchSection.tsx`, `src/screens/home/useHomeScreenData.ts`, `booking.home.*`, `src/screens/MapScreen.tsx` | The branch map is the website map inside a WebView (`MapScreen.tsx`), so it needs the site reachable |
| 9 | Business page: branches, services with prices in сом and duration, team, promotions, Instagram / 2ГИС / map links | `src/screens/business/BusinessScreen.tsx`, `discovery.business.*` | Links appear only if the business filled them in |
| 10 | Several services in one booking, «Любой мастер» | `src/screens/booking/BookingStep2Service.tsx`, `BookingStep3Staff.tsx`, `booking.step3.anyMaster` | — |
| 11 | Reschedule and cancel before the visit starts | `src/screens/bookingDetails/RescheduleSheet.tsx`, `cabinet.details.reschedule*`, `cabinet.details.startedNotice` | Rules (`packages/core-domain/src/booking/statusTransitions.ts`, `clientBookingActions`): cancel — status «В ожидании» or «Подтверждено» and the visit has not started; reschedule — only «Подтверждено», not started, and no promotion or visit package (`cabinet.details.benefitRescheduleNotice`). After the start only the business can change it (`BOOKING_ALREADY_STARTED`). The copy states these limits |
| 12 | Book again, call the salon, WhatsApp, directions | `src/screens/bookingDetails/BookingDetailsSections.tsx`, `cabinet.details.repeat/call/whatsapp/directions` | — |
| 13 | Rating and review after the visit | `src/screens/cabinet/ReviewSheet.tsx`, `cabinet.review.*` | Not verified on a device (needs a completed visit). The comment is visible only to the owner |
| 14 | Client's visit packages: visits left, expiry | `src/screens/cabinet/VisitPackagesBlock.tsx`, `cabinet.packages.*` | — |
| 15 | Russian, Kyrgyz and English | `src/i18n/LanguageSwitcher.tsx`, `src/i18n/dictionaries/*.{ru,ky,en}.ts` | — |
| 16 | Staff workspace: upcoming/past bookings, call/WhatsApp client, schedule for this and next week | `src/screens/StaffScreen.tsx`, `src/screens/StaffScheduleScreen.tsx`, `staff.workspace.*`, `staff.schedule.currentWeek/nextWeek` | — |
| 17 | Master books a client for their own services | `src/screens/StaffCreateBookingScreen.tsx`, `parity.staffBooking.title`, `parity.staffServices.title` | Owner rule: a master sees only the services they perform |
| 18 | My shift with offline queue; shifts and statistics by day/month/year; several businesses; team invitations | `src/screens/ShiftQuickScreen.tsx`, `src/screens/ShiftsScreen.tsx`, `src/screens/staff/StaffBusinessPicker.tsx`, `src/screens/cabinet/StaffInvitationsBlock.tsx`, `staff.shiftQuick.*`, `staff.shifts.*` | — |
| 19 | Business dashboard: day calendar by master, filtered list, quick desk; confirm / arrived / no-show / cancel | `src/screens/manage/bookings/*`, `ops.bookings.*`, `ops.desk.title` | — |
| 20 | App Store has no Kyrgyz localization | App Store Connect language list | Check in App Store Connect when creating the listing; Google Play supports ky-KG |
| 21 | Branches with map location and hours, services and their masters, branch promotions | `src/screens/manage/catalog/BranchEditScreen.tsx`, `mapPicker/BranchMapPicker.tsx`, `BranchScheduleScreen.tsx`, `ServiceMastersSection.tsx`, `BranchPromotionsScreen.tsx` | A branch limit exists (`catalog.branches.new.limit.title`), so the copy does not say «unlimited» |
| 22 | Staff: schedules, absences, temporary transfers, revenue share and rate | `src/screens/manageStaff/ManageStaffScheduleScreen.tsx`, `ManageStaffDetailScreen.tsx`, `manageStaff.scheduleForm.absenceTitle`, `manageStaff.staff.schedule.transfers.*`, `manageStaff.staff.form.income.title` | — |
| 23 | Finance by shift and employee; analytics (bookings, conversion, revenue, load by hour, promo share) | `src/screens/manage/finance/*`, `src/screens/manage/analytics/ManageAnalyticsScreen.tsx`, `ops.finance.*`, `ops.analytics.*` | Analytics shows data only after periodic calculation (`ops.analytics.emptyHint`) — matters for screenshot O5 |
| 24 | Visit packages: create and issue to clients | `src/screens/manage/visitPackages/*`, `SellPackageModal.tsx`, `ops.packages.*` | The UI says «Продать пакет»; the copy says «оформляйте» to avoid implying payment in the app |
| 25 | Ratings of business, branches and staff; client reviews visible to the owner | `ops.home.rating.title`, `src/screens/manage/catalog/BranchRatingCard.tsx`, `manageStaff.staff.rating.title`, `manageStaff.staff.detail.sections.reviews.title`, `docs/RATINGS_HOW_IT_WORKS.md` | — |
| 26 | Connect a business by application, linked to the account after review | `src/screens/apply/BusinessApplyScreen.tsx`, `parity.apply.page.*` | Review is done by Kezek staff on the web |
| 27 | **gate** «Салоны, барбершопы и студии Оша» in the catalogue | Prod is test-scale; test businesses are public (memory, launch blockers) | The listing describes the service; at launch the catalogue should contain real Osh businesses and hide «Тестовый бизнес» |
| 28 | Website kezek.vercel.app | `app.json` (intent filters), `docs/DOMAIN_LOSS_RUNBOOK.md` | Replace in all texts when a new domain is bought |
| 29 | No payment in the app | Owner decision in `.claude/skills/kezek-engineering/SKILL.md` | The copy never mentions payment. Note: the client booking details still show «Оплачено пакетом» (`cabinet.details.paidWithPackage`) — avoid that screen state in screenshots |
| 30 | English screen names «Business dashboard», «Staff workspace», «My account» | `parity.en.ts` (`parity.workspaces.*`), `staff.en.ts`, `nav.en.ts` | The English tab labels in the app are «Business» and «Work», and the staff header `nav.staff` is «Workspace»; the copy follows the owner's terms |
| 31 | **gate** Cyrillic keywords fit Apple's 100 limit | Count lines under the keyword blocks (characters and UTF-8 bytes) | The ru/ky keyword strings are under 100 characters but about 175–200 UTF-8 bytes. If App Store Connect rejects them as too long, drop words from the end until it accepts |

## Needed from the owner

- Google Play Console and Apple Developer accounts (App Store Connect), and a decision on Sign in
  with Apple before the iOS review.
- FCM and APNs keys in the release build (push), `WHATSAPP_OTP_HASH_SECRET` in Vercel (WhatsApp
  sign-in).
- Support e-mail or phone and a support URL, privacy policy and terms URLs (both stores require them).
- App icon and feature graphic (Google Play 1024×500) source files; any brand colours beyond the app's.
- Real Osh businesses in the catalogue (and test businesses hidden) before screenshots and launch, or
  explicit approval to shoot on «Тестовый бизнес» data.
- A native Kyrgyz speaker to review the ky section.
- Data safety (Play) and App Privacy (Apple) answers are a separate task: they must be drafted from
  what the code collects (phone, name, e-mail, location for nearby search, push token, crash reports
  if Sentry is on).

## Проверка фактов (28.11.2026)

Проверено по коду дерева на 28.11.2026 (`apps/mobile/src`, `apps/web/src`, `packages/core-domain`, `apps/web/vercel.json`, `supabase/migrations`).

**Подтверждено в коде:** каталог, поиск по названию или адресу, «Популярные категории», «Ближайшие филиалы» в радиусе 20 км (`useNearbyBranches.ts`: `NEARBY_RADIUS_KM = 20`, 5 филиалов), карта филиалов (WebView сайта); страница бизнеса (филиалы, услуги, «Команда», акции, Instagram, 2ГИС); запись без регистрации (`BookingGuestForm` в шаге подтверждения); несколько услуг и «Любой мастер»; отмена до начала визита (`hold`/`confirmed`) и перенос только подтверждённой записи без акции и пакета (`clientBookingActions`, `BOOKING_ALREADY_STARTED` на сервере); повтор, звонок, WhatsApp, маршрут; оценка 1–5 и отзыв после визита, комментарий видит только владелец; «Мои пакеты» (осталось визитов, «Действует до»); вход Google, Telegram, WhatsApp (флаги включены по умолчанию) и Apple на iOS (код в рабочем дереве, не закоммичен), паролей нет; кабинет сотрудника (предстоящие/прошедшие, текущая и следующая неделя, запись на свои услуги, «Моя смена» с офлайн-очередью, статистика за день/месяц/год с клиентами и долей, выбор бизнеса, приглашения); кабинет бизнеса (календарь, список, «Ресепшен», действия Подтвердить / Пришёл / Не пришёл / Отменить, филиалы с картой и графиком, акции, графики, отсутствия, временные переводы, распределение дохода и ставка, финансы, аналитика с конверсией, загрузкой по часам и долей промо, пакеты визитов, рейтинги бизнеса/филиала/сотрудника и отзывы, заявка на подключение). Слов об оплате в тексте нет.

**Уведомления:** напоминания за 24 ч и за 2 ч клиенту и подтверждения/отмены реально ставятся в очередь (`enqueue_booking_reminders` в начале каждого запуска worker, pg_cron `kezek_booking_notifications` каждые 2 минуты, плюс Vercel cron `/api/cron/booking-notifications` раз в сутки). Отправка идёт только при `BOOKING_NOTIFICATION_WORKER_ENABLED=true`. Push уходит через Expo, но без ключа FCM V1 (Android) и APNs (iOS) в новой сборке не доставляется. WhatsApp о записях ждёт одобрения шаблонов Meta, e-mail — домена и `EMAIL_FROM`: в тексте их нет.

**Исправлено в этом файле:**
- Пункт об уведомлениях в ru/ky/en заменён на вариант без push («в Telegram, если подключить его в профиле»); вариант с push оставлен закомментированной альтернативой рядом с каждым описанием.
- Пункт «перенести или отменить» был шире правил: теперь «отменить до начала визита, а подтверждённую — перенести; запись с акцией или пакетом переносит салон» (ru/ky/en).
- Пункт о записи без регистрации обещал, что после входа «все записи сохранятся»: гостевая запись к аккаунту не привязывается, теперь «записывайтесь после входа».
- Кадр C5: запись без акции и пакета, иначе нет кнопки «Перенести запись» и видна строка «Оплачено пакетом» (`cabinet.details.paidWithPackage`, она остаётся в приложении — избегать в кадрах).
- Пересчитаны длины полных описаний: ru 2438, ky 2701, en 2460 из 4000; строки push-варианта 74/75/74. Остальные поля не менялись и в лимитах.

**Остаётся гейтом (зависит от владельца):**
- `BOOKING_NOTIFICATION_WORKER_ENABLED=true` в Vercel (OWNER_ACTIONS №17): без него не уходят ни Telegram, ни push — тогда и строку о напоминаниях публиковать нельзя.
- Telegram: перенос домена бота на kezek.vercel.app (№4) — без него не работают вход и привязка Telegram.
- Push: ключ FCM (№9), APNs при сборке iOS, новая сборка EAS (№16), проверка на телефоне — только потом вариант с push.
- Вход: `WHATSAPP_OTP_HASH_SECRET` (№5), Apple-вход (№6–7) до проверки App Store; до этого способы входа не перечислять.
- Каталог с реальными салонами Оша и скрытые тестовые бизнесы (№13) до скриншотов и запуска.
- Отзыв и push на устройстве не проверены; кадр O5 требует рассчитанной аналитики; кыргызский текст — проверка носителем (№15).
