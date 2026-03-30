# HOWTO: новый API endpoint (шаблон)

Краткий паттерн для добавления нового endpoint в `apps/web/src/app/api/**/route.ts`.

## 1. Общий поток

Целевой шаблон для route handlers:

**route = transport + validation + auth/context**

Практически это выглядит как:

**HTTP → auth/context → validation (Zod) → use-case/service → HTTP‑ответ**

1. **HTTP‑обёртка / transport**  
   - `export async function GET/POST(...)`  
   - оборачиваем тело в `withRateLimit` (если нужно) и `withErrorHandler`.

2. **Auth / context**  
   - для приватных route используем `withManagerContext`, `withManagerAndStaffContext` или другой context-wrapper;
   - для public route явно создаем нужный клиент/контекст (`createSupabaseAnonClient`, request-scoped helpers);
   - route только подключает контекст, но не держит внутри бизнес-процесс.

3. **Валидация входа**  
   - для `body`/`query` используем `validateRequest` / `validateQuery` и Zod‑схему из `lib/validation/*`;
   - при ошибке сразу возвращаем `validationResult.response`.

4. **Доменная валидация** (по необходимости)  
   - для сложных кейсов используем функции из доменных модулей (`@core-domain/booking`, `@core-domain/schedule`);
   - сюда попадают уже нормализованные данные после Zod.

5. **Use‑case / service**  
   - собираем зависимости доменного use‑case: репозитории (`@core-domain/ports` + адаптеры в `lib/repositories.ts`), команды (RPC/SQL) и нотификации;
   - вызываем use‑case из `@core-domain/*` или app-level service, если кейс еще не доведен до доменного слоя;
   - именно здесь живут orchestration, RPC, confirm, notify и другие шаги процесса.

6. **Ответ**  
   - на успех: `createSuccessResponse(payload)`;
   - на ошибку внутри use‑case: кидаем `Error` и даём `withErrorHandler` сформировать JSON об ошибке.

## 2. Что должно остаться в route.ts

В route handler допустимы только:

- HTTP transport (`GET/POST`, `req`, `params`, status/response mapping)
- подключение rate limit / error wrapper
- auth/context wrapper или создание request-scoped context
- Zod-валидация и легкая нормализация входа
- вызов одного use-case/service

В route handler не должно оставаться:

- длинной RPC-orchestration логики
- последовательности `branch check -> hold -> confirm -> notify`
- сложной бизнес-ветвистости
- логики, которую нельзя протестировать отдельно от Next route handler

## 3. Пример: упрощённый `quick-hold`

Фрагмент обработчика (детали опущены для краткости):

```ts
export async function POST(req: Request) {
  return withRateLimit(
    req,
    RateLimitConfigs.public,
    async () =>
      withErrorHandler('QuickHold', async () => {
        // 1) Auth/context
        const supabase = await createSupabaseServerClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          return createErrorResponse('auth', 'Not signed in', undefined, 401);
        }

        // 2) Zod-валидация
        const validationResult = await validateRequest(req, quickHoldSchema);
        if (!validationResult.success) {
          return validationResult.response;
        }

        // 3) Доменная валидация (booking)
        const domainValidation = validateCreateBookingParams(validationResult.data);
        if (!domainValidation.valid || !domainValidation.data) {
          return createErrorResponse('validation', domainValidation.error ?? 'Invalid params', undefined, 400);
        }

        // 4) Use-case/service deps
        const branchRepository = new SupabaseBranchRepository(supabase);
        const commands: BookingCommandsPort = { /* реализация RPC */ };
        const notifications: BookingNotificationPort = { /* вызов /api/notify или локальной функции */ };

        // 5) Вызов use-case
        const { bookingId } = await createBookingUseCase(
          { branchRepository, commands, notifications },
          domainValidation.data,
        );

        // 6) HTTP-ответ
        return createSuccessResponse({ booking_id: bookingId, confirmed: true });
      }),
  );
}
```

## 4. Выбор места для логики

- **Валидация формата** (`string`, `uuid`, `date-time`) → Zod‑схемы в `lib/validation`.
- **Бизнес‑инварианты** (обязательность полей, комбинации статусов, промо и т.п.) → доменные модули в `@core-domain/*`.
- **Работа с БД** (Supabase таблицы/RPC) → адаптеры в `lib/repositories.ts` или локальные "команды" (реализация портов).  
  Доменные use‑case видят только интерфейсы из `@core-domain/ports`.

## 5. Чек‑лист при добавлении endpoint

- [ ] Обёртка `withErrorHandler` и `withRateLimit` (если публичный/часто вызываемый роут).
- [ ] Auth/context подключается единообразно и не размазан по файлу.
- [ ] Zod‑валидация через `validateRequest`/`validateQuery`.
- [ ] При необходимости — доменная валидация из `@core-domain/*`.
- [ ] Логика бизнес‑процесса вынесена в use‑case/service (по возможности).
- [ ] Доступ к БД идёт через адаптеры/порты, а не напрямую из use‑case.
- [ ] Ответы формируются через `createSuccessResponse` / `createErrorResponse`.
- [ ] При изменении контрактов обновлена Swagger‑документация и тесты.
```

