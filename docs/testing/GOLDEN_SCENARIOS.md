# Золотые сценарии

Короткий обязательный набор пользовательских путей, которые должны оставаться защищены тестами даже при дальнейших рефакторингах.

---

## Зачем нужен этот список

`Golden scenarios` — это не полный каталог всех проверок, а минимальный набор самых ценных путей:

- они проходят через несколько слоев системы;
- они критичны для бизнеса и пользовательского опыта;
- они часто страдают при изменениях в routing, auth, booking, finance и timezone-логике.

Если нужно выбирать, что держать зелёным в первую очередь, это именно эти сценарии.

---

## Минимальный обязательный набор

### 1. Публичная запись

Что должно быть защищено:

- вход в public booking flow;
- выбор услуги, мастера, даты и слота;
- успешное создание записи;
- корректная обработка недоступного или конфликтного слота.

Текущие связанные проверки:

- [booking-flow.spec.ts](C:\projects\kezek\apps\web\e2e\booking-flow.spec.ts)
- [slots-conflicts.test.ts](C:\projects\kezek\apps\web\src\__tests__\api\booking\slots-conflicts.test.ts)

### 2. Вход и редирект по роли

Что должно быть защищено:

- post-sign-in redirect;
- попадание пользователя в правильный кабинет;
- корректный fallback при разных наборах ролей.

Текущие связанные проверки:

- [redirect.test.ts](C:\projects\kezek\apps\web\src\__tests__\app\auth\sign-in\redirect.test.ts)

### 3. Выбор бизнеса

Что должно быть защищено:

- приоритет `current_biz`, если он валиден;
- детерминированный fallback по доступным бизнесам;
- корректное поведение при потере доступа к бизнесу.

Текущие связанные проверки:

- [bizContextResolver.test.ts](C:\projects\kezek\apps\web\src\__tests__\lib\bizContextResolver.test.ts)

### 4. Просмотр и отмена записи

Что должно быть защищено:

- пользователь видит свои записи;
- запись корректно делится на `upcoming/past`;
- отмена записи меняет статус предсказуемо и без регрессий.

Текущие связанные проверки:

- [cancel.test.ts](C:\projects\kezek\apps\web\src\__tests__\api\bookings\cancel.test.ts)
- [BookingDetailsScreen.test.tsx](C:\projects\kezek\apps\mobile\src\__tests__\screens\BookingDetailsScreen.test.tsx)
- [CabinetScreen.test.tsx](C:\projects\kezek\apps\mobile\src\__tests__\screens\CabinetScreen.test.tsx)

### 5. Ключевой staff/finance сценарий

Что должно быть защищено:

- открытие смены;
- работа с shift items;
- закрытие смены;
- базовый finance flow без поломки итогов и гарантий.

Текущие связанные проверки:

- [open.test.ts](C:\projects\kezek\apps\web\src\__tests__\api\staff\shift\open.test.ts)
- [items.test.ts](C:\projects\kezek\apps\web\src\__tests__\api\staff\shift\items.test.ts)
- [close.test.ts](C:\projects\kezek\apps\web\src\__tests__\api\staff\shift\close.test.ts)
- [shift-management.spec.ts](C:\projects\kezek\apps\web\e2e\shift-management.spec.ts)
- [staff-finance-pages.spec.ts](C:\projects\kezek\apps\web\e2e\staff-finance-pages.spec.ts)

---

## Что считать достаточным уровнем защиты

Для каждого золотого сценария достаточно, если у него есть:

- либо один короткий, стабильный E2E-сценарий;
- либо связка из integration/unit тестов, если E2E здесь слишком дорогой или хрупкий.

Задача не в том, чтобы всё тащить в browser E2E, а в том, чтобы не оставить критичный путь без реальной страховки.

---

## Как использовать этот список

При любом крупном рефакторинге сначала проверять, затрагивает ли он один из сценариев выше.

Если затрагивает, перед изменениями нужно:

1. убедиться, что на сценарий уже есть тестовая страховка;
2. при необходимости усилить её до начала рефакторинга;
3. не считать задачу завершённой, пока соответствующий золотой сценарий снова не зелёный.
