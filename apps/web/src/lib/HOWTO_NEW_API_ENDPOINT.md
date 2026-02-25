# HOWTO: новый API endpoint (шаблон)

Краткий паттерн для добавления нового endpoint в `apps/web/src/app/api/**/route.ts`.

## 1. Общий поток

**HTTP → валидация (Zod) → use‑case → HTTP‑ответ**:

1. **HTTP‑обёртка**  
   - `export async function GET/POST(...)`  
   - оборачиваем тело в `withRateLimit` (если нужно) и `withErrorHandler`.

2. **Валидация входа**  
   - для `body`/`query` используем `validateRequest` / `validateQuery` и Zod‑схему из `lib/validation/*`;
   - при ошибке сразу возвращаем `validationResult.response`.

3. **Доменная валидация** (по необходимости)  
   - для сложных кейсов используем функции из доменных модулей (`@core-domain/booking`, `@core-domain/schedule`);
   - сюда попадают уже нормализованные данные после Zod.

4. **Use‑case**  
   - собираем зависимости доменного use‑case: репозитории (`@core-domain/ports` + адаптеры в `lib/repositories.ts`), команды (RPC/SQL) и нотификации;
   - вызываем use‑case из `@core-domain/*`.

5. **Ответ**  
   - на успех: `createSuccessResponse(payload)`;
   - на ошибку внутри use‑case: кидаем `Error` и даём `withErrorHandler` сформировать JSON об ошибке.

## 2. Пример: упрощённый `quick-hold`

Фрагмент обработчика (детали опущены для краткости):

```ts
export async function POST(req: Request) {
  return withRateLimit(
    req,
    RateLimitConfigs.public,
    async () =>
      withErrorHandler('QuickHold', async () => {
        // 1) Auth + Supabase client
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

        // 4) Use-case deps
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

## 3. Выбор места для логики

- **Валидация формата** (`string`, `uuid`, `date-time`) → Zod‑схемы в `lib/validation`.
- **Бизнес‑инварианты** (обязательность полей, комбинации статусов, промо и т.п.) → доменные модули в `@core-domain/*`.
- **Работа с БД** (Supabase таблицы/RPC) → адаптеры в `lib/repositories.ts` или локальные "команды" (реализация портов).  
  Доменные use‑case видят только интерфейсы из `@core-domain/ports`.

## 4. Чек‑лист при добавлении endpoint

- [ ] Обёртка `withErrorHandler` и `withRateLimit` (если публичный/часто вызываемый роут).
- [ ] Zod‑валидация через `validateRequest`/`validateQuery`.
- [ ] При необходимости — доменная валидация из `@core-domain/*`.
- [ ] Логика бизнес‑процесса вынесена в use‑case (по возможности).
- [ ] Доступ к БД идёт через адаптеры/порты, а не напрямую из use‑case.
- [ ] Ответы формируются через `createSuccessResponse` / `createErrorResponse`.
- [ ] При изменении контрактов обновлена Swagger‑документация и тесты.
```

