# Аудит терминологии кабинетов в UI

Документ фиксирует текущие тексты про кабинеты в вебе и мобиле, целевую схему именования и план по обновлению i18n/документации (блок 5.5 в `OWNER_CABINET_RISKS_AND_IMPROVEMENTS_TASKS.md`).

---

## 1. Маршруты и роли

| Маршрут | Роль | Назначение |
|---------|------|------------|
| `/dashboard` | Владелец, админ, менеджер | Управление бизнесом: брони, сотрудники, финансы, аналитика, услуги, филиалы |
| `/staff` | Сотрудник | Кабинет сотрудника: смены, записи, финанс по сменам |
| `/cabinet` | Клиент | Личный кабинет клиента: мои записи, профиль |
| `/admin` | Супер-админ | Админ-панель платформы: бизнесы, пользователи, категории, рейтинги, мониторинг |

---

## 2. Текущие тексты (веб)

### 2.1. i18n-ключи и значения (RU)

**header.*** (шапка, переключатель ролей/бизнеса):

| Ключ | RU | EN | Использование |
|------|-----|-----|----------------|
| header.account | аккаунт | account | Подпись к имени пользователя |
| header.adminPanel | Админ-панель | Admin panel | Ссылка на /admin |
| header.businessCabinet | Кабинет бизнеса | Business cabinet | Ссылка на /dashboard (роль admin/manager) |
| header.cabinetShort | Кабинет | Cabinet | Краткая подпись |
| header.myBookings | Мои записи | My bookings | Ссылка на /cabinet |
| header.ownerCabinet | Кабинет владельца | Owner cabinet | Ссылка на /dashboard (владелец по owner_id) |
| header.personalCabinet | Личный кабинет | Personal cabinet | Кнопка «Личный кабинет» (PersonalCabinetButton → /cabinet) |
| header.signIn / signOut | Войти / Выйти | Sign in / Sign out | — |
| header.staffCabinet | Кабинет сотрудника | Staff cabinet | Ссылка на /staff |
| header.staffCabinetShort | Сотрудник | Staff | — |

**header.roleBusiness.*** (дропдаун роли/бизнеса — часть ключей только fallback в коде, могут отсутствовать в словарях):

| Ключ (fallback в коде) | RU | Использование |
|------------------------|-----|----------------|
| header.roleBusiness.loading | Загружаем доступные кабинеты... | RoleAndBusinessSwitcher |
| header.roleBusiness.client | Клиент | Метка роли |
| header.roleBusiness.admin | Админ | Метка роли |
| header.roleBusiness.owner | Владелец / менеджер | Метка роли |
| header.roleBusiness.staff | Сотрудник | Метка роли |
| header.roleBusiness.someBusiness / noBusiness | Бизнес / Без бизнеса | Метка текущего бизнеса |
| header.roleBusiness.caption | Выберите кабинет или бизнес | Подпись дропдауна |
| header.roleBusiness.sections.cabinets | Кабинеты | Секция «Кабинеты» |
| header.roleBusiness.sections.businesses | Бизнесы | Секция «Бизнесы» |

**dashboard.*** (кабинет бизнеса / дашборд):

| Ключ | RU | Заметка |
|------|-----|--------|
| dashboard.sidebar.title | Кабинет бизнеса | Заголовок сайдбара дашборда |
| dashboard.header.badge | Кабинет владельца бизнеса | Бейдж на главной дашборда |
| dashboard.header.defaultBizName | Ваш бизнес в Kezek | Подставное имя бизнеса |
| dashboard.error.noAccess / noAccessDesc | Нет доступа к кабинету / описание | Ошибки доступа |
| dashboard.error.generalDesc | Ошибка при загрузке кабинета... | Общая ошибка |
| dashboard.bookings.noAccess.title | Нет доступа к кабинету | Брони |
| dashboard.onboarding.title | Давай доведём кабинет до рабочего состояния. | Онбординг |

**cabinet.*** (клиентский кабинет /cabinet):

| Ключ | RU | Заметка |
|------|-----|--------|
| cabinet.bookings.title | Мои записи | Заголовок раздела записей |
| cabinet.nav.bookings | Мои записи | Пункт навигации |
| cabinet.nav.profile | Профиль | — |

**admin.*** (админ-панель):

| Ключ | RU | Заметка |
|------|-----|--------|
| admin.home.title | Панель администратора | Главная админки |
| admin.noAccess.title | Нет доступа (нужен супер-админ) | — |
| admin.categories.backToAdmin | В админку | — |
| admin.users.backToAdmin | В админку | — |

**staff.*** (раздел «Сотрудники» в дашборде и кабинет сотрудника):

| Ключ | RU | Заметка |
|------|-----|--------|
| staff.title | Сотрудники | Страница списка сотрудников (дашборд) |
| staff.subtitle | Управление сотрудниками и их услугами | — |
| staff.cabinet.bookings.title | Мои записи | Кабинет сотрудника: записи |
| staff.layout.noAccess.desc | У учётной записи нет роли staff... | Нет доступа к /staff |

**selectBusiness.*** (страница выбора бизнеса):

| Ключ | Fallback RU | Заметка |
|------|-------------|--------|
| selectBusiness.title | Выберите бизнес для работы | — |
| selectBusiness.subtitle | У вашего аккаунта несколько бизнесов... | — |
| selectBusiness.hint | Вы всегда сможете сменить бизнес в левом меню кабинета... | Жестко в коде в page.tsx |
| selectBusiness.loadingTitle / errorTitle / errorSubtitle | — | — |

### 2.2. Жёстко заданные строки (без i18n или только fallback)

| Место | Текст | Рекомендация |
|-------|--------|--------------|
| AuthStatusServer.tsx getTargetPath | 'Мои записи', 'Админ-панель', 'Кабинет владельца', 'Кабинет сотрудника', 'Кабинет бизнеса' | Заменить на t('header.myBookings') и т.д. |
| select-business/page.tsx | Подсказка про «левый меню кабинета» | Вынести в selectBusiness.hint в словари |
| DashboardHomeClient | Использует t('dashboard.header.badge', 'Кабинет владельца бизнеса') | Уже i18n |
| RoleAndBusinessSwitcher | Все header.roleBusiness.* с fallback | Добавить ключи в header.ru/en/ky при необходимости |

---

## 3. Мобильное приложение

| Экран/место | Текст | Файл |
|-------------|--------|------|
| CabinetScreen | «Личный кабинет», «Мои записи» | Жестко в разметке (CabinetScreen.tsx) |
| Навигация | CabinetMain, Shifts, DashboardScreen, StaffScreen | types, MainNavigator |
| useUserRole | Логика выбора дашборд/staff/cabinet | — |

В мобиле нет единого i18n для экранов кабинетов: строки «Личный кабинет» и «Мои записи» захардкожены в CabinetScreen. Рекомендация: вынести в общие строки (например, `cabinet.title`, `cabinet.bookings.title`) и подключать локализацию в приложении.

---

## 4. Целевая схема именования

Принять единые термины для маршрутов и UI:

| Маршрут | Короткое название (меню, кнопки) | Развёрнутое название (заголовки, описание) | EN (кратко) |
|---------|-----------------------------------|--------------------------------------------|-------------|
| /dashboard | Кабинет бизнеса | Кабинет владельца бизнеса (на главной дашборда можно оставить как «кабинет владельца бизнеса» или «Кабинет бизнеса») | Business cabinet |
| /staff | Кабинет сотрудника | Кабинет сотрудника | Staff cabinet |
| /cabinet | Мои записи | Личный кабинет / Мои записи | My bookings |
| /admin | Админ-панель | Панель администратора | Admin panel |

**Решение по дублированию «Кабинет владельца» vs «Кабинет бизнеса»:**

- В навигации и переключателе ролей: **«Кабинет бизнеса»** (один термин для владельца, админа и менеджера).
- На главной странице дашборда (бейдж): можно оставить **«Кабинет владельца бизнеса»** для эмоциональной связи или заменить на **«Кабинет бизнеса»** для единообразия.
- В i18n: зафиксировать один ключ для «куда ведёт ссылка» (например, header.businessCabinet = «Кабинет бизнеса»), отдельный ключ для бейджа на главной (dashboard.header.badge = «Кабинет владельца бизнеса» или «Кабинет бизнеса» — по решению продукта).

---

## 5. План обновления i18n и документации

### 5.1. Зафиксировать целевые названия

- [ ] В этом документе уже предложена схема (раздел 4). Утвердить с продуктом: бейдж на главной дашборда — «Кабинет владельца бизнеса» или «Кабинет бизнеса».
- [ ] Добавить в проект глоссарий (например, в docs/ или в README): таблица «Маршрут → Короткое название → Развёрнутое → EN».

### 5.2. Веб: обновить i18n и компоненты

- [ ] **AuthStatusServer** — убрать хардкод в getTargetPath: использовать t() с ключами header.myBookings, header.adminPanel, header.ownerCabinet, header.staffCabinet, header.businessCabinet. Для этого getTargetPath должен получать функцию t (или возвращать ключи, а не готовые строки), либо компонент передаёт locale/функцию перевода в серверный контекст (если доступно).
- [ ] **AuthStatusClient** — уже использует t(); проверить, что ключи совпадают с целевой схемой (ownerCabinet, businessCabinet, staffCabinet, myBookings, adminPanel).
- [ ] **RoleAndBusinessSwitcher** — добавить ключи header.roleBusiness.* в словари header.ru.ts, header.en.ts, header.ky.ts, чтобы не полагаться только на fallback.
- [ ] **Dashboard:** dashboard.sidebar.title оставить «Кабинет бизнеса»; dashboard.header.badge — по решению (см. выше).
- [ ] **select-business** — вынести подсказку «Вы всегда сможете сменить бизнес...» в i18n (selectBusiness.hint) во все языки.
- [ ] **PersonalCabinetButton** — уже использует header.personalCabinet; при целевой схеме «Мои записи» для пункта меню можно оставить «Личный кабинет» для кнопки или переименовать ключ в «Мои записи» и использовать один ключ с header.myBookings — решить единообразие с ссылкой в дропдауне.

### 5.3. Мобильное приложение

- [ ] Ввести локализацию для CabinetScreen: «Личный кабинет», «Мои записи» — из общего слоя переводов (если в мобиле есть i18n) или добавить константы/файлы локализации.
- [ ] Проверить навигацию и табы: подписи экранов (Dashboard, Staff, Cabinet) привести к целевым названиям и переводу.

### 5.4. Документация

- [ ] В README или в SYSTEM_FEATURES_DOCUMENTATION / PROJECT_DOCUMENTATION добавить раздел «Роли и кабинеты»: таблица «Роль → Доступные кабинеты → Основные функции» (например: Владелец → Кабинет бизнеса → …; Сотрудник → Кабинет сотрудника → …; Клиент → Мои записи → …; Супер-админ → Админ-панель → …).
- [ ] Обновить описание в apps/web/src/app/_components/i18n/dictionaries/README.md: уточнить назначение header.*, dashboard.sidebar.title, cabinet.*, admin.home.title.

### 5.5. Индикатор активной роли и переключатель

- [ ] Отдельная задача 5.5: спроектировать UI индикатора текущей роли и переключателя между кабинетами (частично уже есть RoleAndBusinessSwitcher; доработать по глоссарию и переводам).

---

## 6. Сводная таблица: где что менять

| Компонент / файл | Что проверить / изменить |
|------------------|---------------------------|
| AuthStatusServer.tsx | getTargetPath: заменить хардкод на i18n (ключи header.*) |
| AuthStatusClient.tsx | Уже t(); сверить ключи с глоссарием |
| RoleAndBusinessSwitcher.tsx | Добавить header.roleBusiness.* в словари |
| PersonalCabinetButton.tsx | Решить: «Личный кабинет» vs «Мои записи» для кнопки |
| MobileSidebar.tsx | dashboard.sidebar.title — «Кабинет бизнеса» ✓ |
| DashboardHomeClient.tsx | dashboard.header.badge — утвердить формулировку |
| select-business/page.tsx | Вынести hint в selectBusiness.hint |
| cabinet.*.ts (i18n) | cabinet.bookings.title, cabinet.nav.* — «Мои записи» ✓ |
| staff.ru/en/ky | staff.cabinet.bookings.title, staff.layout.noAccess — согласовать с глоссарием |
| admin.*.ts (i18n) | admin.home.title «Панель администратора» ✓ |
| Mobile CabinetScreen | Локализовать «Личный кабинет», «Мои записи» |
| README / SYSTEM_FEATURES / PROJECT_DOCUMENTATION | Таблица «Роль → Кабинеты → Функции» |

---

## 7. Ссылки

- Задачи: `OWNER_CABINET_RISKS_AND_IMPROVEMENTS_TASKS.md` (блок 4 — «Размытая терминология»; блок 5.5).
- Словари веб: `apps/web/src/app/_components/i18n/dictionaries/` (header.*, dashboard.*, cabinet.*, staff.*, admin.*).
- Компоненты: AuthStatusServer, AuthStatusClient, RoleAndBusinessSwitcher, PersonalCabinetButton, MobileSidebar, DashboardHomeClient, select-business/page.tsx.
- Мобиль: apps/mobile/src/screens/CabinetScreen.tsx.
