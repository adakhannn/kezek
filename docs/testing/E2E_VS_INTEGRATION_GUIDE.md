# Что тестировать в web E2E, а что на integration-level

Короткое правило распределения тестов между browser E2E и более быстрыми integration/unit слоями.

---

## Главный принцип

В `web E2E` нужно оставлять только короткие пользовательские пути, где важно проверить:

- реальный routing;
- browser navigation;
- формы и шаги UI;
- интеграцию нескольких слоев сразу;
- что пользователь действительно может дойти от входа до результата.

Если сценарий можно надёжнее и дешевле проверить без браузера, его лучше покрывать integration-level тестами.

---

## Что должно идти в web E2E

### 1. Короткие золотые пользовательские пути

Это сценарии, где важно видеть весь путь целиком:

- публичная запись;
- вход и редирект по роли;
- базовый staff shift flow;
- критичный staff/finance happy path;
- просмотр ключевых страниц после успешного входа.

Почему E2E:

- здесь ценна именно склейка routing, auth, UI и API;
- браузерная проверка ловит поломки, которые не видны на уровне unit/integration.

---

## Что лучше держать на integration-level

### 1. Доменные правила и матрицы условий

Сюда относятся:

- booking status semantics;
- business selection resolution;
- staff finance calculations;
- validation rules;
- timezone edge cases;
- schedule availability filtering.

Почему не E2E:

- таких веток много;
- они лучше читаются и поддерживаются в unit/integration;
- browser E2E для них будет дорогим, хрупким и медленным.

### 2. API orchestration и route behavior

Сюда относятся:

- shift open/close/items;
- booking cancel / mark-attendance;
- quick-book / quick-hold;
- manager/staff finance endpoints.

Почему лучше integration:

- важно проверить response, orchestration и доменные последствия;
- не обязательно поднимать браузер, чтобы проверить эти инварианты.

### 3. Timezone и boundary cases

Сюда относятся:

- переход через границу дня;
- `biz.tz` vs global fallback;
- `upcoming/past`;
- date period boundaries.

Почему лучше integration/unit:

- эти кейсы точнее и стабильнее тестируются через функции и API-level сценарии;
- в E2E они слишком зависят от окружения и данных.

---

## Практическое распределение по текущему проекту

### Оставить в web E2E

- [booking-flow.spec.ts](C:\projects\kezek\apps\web\e2e\booking-flow.spec.ts)
- [shift-management.spec.ts](C:\projects\kezek\apps\web\e2e\shift-management.spec.ts)
- [staff-finance-pages.spec.ts](C:\projects\kezek\apps\web\e2e\staff-finance-pages.spec.ts)
- при необходимости один короткий сценарий входа/редиректа по роли

### Держать на integration-level

- [redirect.test.ts](C:\projects\kezek\apps\web\src\__tests__\app\auth\sign-in\redirect.test.ts)
- [bizContextResolver.test.ts](C:\projects\kezek\apps\web\src\__tests__\lib\bizContextResolver.test.ts)
- [slots-conflicts.test.ts](C:\projects\kezek\apps\web\src\__tests__\api\booking\slots-conflicts.test.ts)
- [open.test.ts](C:\projects\kezek\apps\web\src\__tests__\api\staff\shift\open.test.ts)
- [items.test.ts](C:\projects\kezek\apps\web\src\__tests__\api\staff\shift\items.test.ts)
- [close.test.ts](C:\projects\kezek\apps\web\src\__tests__\api\staff\shift\close.test.ts)
- [time.test.ts](C:\projects\kezek\apps\web\src\__tests__\lib\time.test.ts)
- [createBookingUseCase.test.ts](C:\projects\kezek\packages\core-domain\src\booking\__tests__\createBookingUseCase.test.ts)

---

## Простое правило выбора

Если вопрос звучит как:

- “может ли пользователь реально пройти путь?” — это кандидат в E2E
- “правильно ли система принимает решение?” — это кандидат в integration/unit

---

## Что не делать

- не тащить в E2E все ветки ролей, таймзон и доменных статусов;
- не проверять через браузер то, что уже надёжно фиксируется на API/domain уровне;
- не плодить длинные E2E-сценарии с несколькими независимыми целями.
