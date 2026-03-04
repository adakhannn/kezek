## Guide: безопасное использование service client в кабинете бизнеса

Этот документ дополняет аудит `SERVICE_CLIENT_AND_BIZ_FILTERS_AUDIT.md` и задаёт **обязательные правила** использования service client (`getServiceClient`, `createSupabaseAdminClient`) в веб‑приложении, в первую очередь для `/api/dashboard/*` и связанных API кабинета менеджера.

---

## 1. Базовые принципы

- **Service client всегда обходит RLS**. Любая ошибка в фильтрах по бизнесу сразу превращается в утечку данных между бизнесами.
- **Единственный источник контекста для кабинета менеджера/владельца** — `withManagerContext`, который:
  - разрешает пользователя и его роли через `getBizContextForManagers()`;
  - фиксирует `bizId`, `userId`;
  - создаёт:
    - `supabase` — клиент с RLS от лица пользователя;
    - `admin` — service client без RLS.
- **Все маршруты `/api/dashboard/*` и все «менеджерские» API должны использовать service client только через `withManagerContext`.**

```ts
// Паттерн по умолчанию
export async function GET(req: Request) {
  return withErrorHandler('SomeScope', async () =>
    withManagerContext(req, 'SomeScope', async ({ supabase, admin, bizId, userId }) => {
      // supabase — RLS-клиент от имени менеджера
      // admin — service client c обходом RLS
      // bizId — проверенный бизнес, к которому есть права
    }),
  );
}
```

Подробности реализации и тесты обёртки — в `lib/withManagerContext.ts` и `__tests__/lib/withManagerContext.test.ts`.

---

## 2. Где **обязательно** использовать `withManagerContext`

Во всех следующих случаях **service client допускается только из `withManagerContext`**:

- любые маршруты под:
  - `/api/dashboard/*`;
  - `/api/staff/*`, `/api/branches/*`, `/api/services/*`, `/api/bookings/*`, если они работают «от лица» менеджера/владельца;
  - любые новые API кабинета бизнеса (которые завязаны на текущий `bizId` менеджера).
- серверные страницы/компоненты, которые читают данные по одному бизнесу и ранее сами звали `getBizContextForManagers` + `getServiceClient`.

**Инварианты:**

1. Контекст менеджера (`bizId`, `userId`) всегда приходит извне — из `withManagerContext`, а не из query/body.
2. Любой доступ к данным с `biz_id` через `admin` обязан:
   - либо содержать `.eq('biz_id', bizId)` / аналогичное условие;
   - либо предварительно проверять принадлежность сущности через:
     - `checkResourceBelongsToBiz`,
     - `checkResourceBelongsToBusiness`.
3. При вставке строк `biz_id` всегда берётся из `bizId` из контекста, **никогда** — из запроса пользователя.
4. Для вложенных сущностей (filial, staff, service, promotion) сначала проверяется, что родитель принадлежит `bizId`, и только потом выполняются изменения.

Ниже — примеры корректных запросов (п. 2.1) и анти‑паттерны (раздел 4). Подробные требования — в `docs/SERVICE_CLIENT_AND_BIZ_FILTERS_AUDIT.md` (раздел 3).

### 2.1. Примеры корректных запросов

**Чтение по бизнесу (всегда фильтр по biz_id):**

```ts
// ✅ Список филиалов текущего бизнеса
const { data } = await admin
  .from('branches')
  .select('id, name, address')
  .eq('biz_id', bizId)
  .order('name');

// ✅ Агрегаты аналитики по бизнесу
const { data } = await admin
  .from('business_daily_stats')
  .select('*')
  .eq('biz_id', bizId)
  .gte('date', fromDate)
  .lte('date', toDate);
```

**Вложенная сущность: сначала проверка принадлежности, потом запрос:**

```ts
// ✅ Сначала проверяем, что staff принадлежит bizId
const staffCheck = await checkResourceBelongsToBiz<{ id: string; biz_id: string }>(
  admin,
  'staff',
  staffId,
  bizId,
);
if (!staffCheck.valid) return createErrorResponse('forbidden', staffCheck.error, undefined, 403);

// Затем запросы по этой сущности (staff уже принадлежит bizId)
const { data } = await admin
  .from('staff_shifts')
  .select('*')
  .eq('staff_id', staffId)
  .eq('biz_id', bizId);
```

**Вставка: biz_id только из контекста:**

```ts
// ✅ biz_id из withManagerContext, не из body
await admin.from('branches').insert({
  biz_id: bizId,
  name: body.name,
  address: body.address,
  is_active: true,
});

// ✅ RPC с параметром бизнеса из контекста
const { data } = await admin.rpc('get_staff_finance_summary', { p_biz_id: bizId });
```

**Работа с филиалом: проверка branch.biz_id:**

```ts
// ✅ Загружаем филиал и проверяем принадлежность
const { data: branch } = await admin.from('branches').select('id, biz_id').eq('id', branchId).maybeSingle();
if (!branch || String(branch.biz_id) !== String(bizId)) {
  return createErrorResponse('forbidden', 'Филиал не принадлежит бизнесу', undefined, 403);
}
// Дальше — запросы с .eq('biz_id', bizId) для связанных таблиц
await admin.from('branch_working_hours').delete().eq('biz_id', bizId).eq('branch_id', branchId);
```

---

## 3. Исключения, где можно использовать service client **без** `withManagerContext`

Исключения должны быть **явно задокументированы** в коде и в этом разделе.

### 3.1. `/api/admin/*`

- Контекст: `super_admin`, операции по многим бизнесам или по всей платформе.
- Проверка доступа: RPC `is_super_admin` / аналогичный чек перед созданием service client.
- Примеры:
  - системная аналитика по всем бизнесам;
  - health‑check платформы;
  - административные операции, которые по смыслу выходят за рамки одного `bizId`.

**Правило:** для `/api/admin/*` service client можно создавать напрямую (через `getServiceClient` или `createSupabaseAdminClient`), но:

- перед этим обязательна проверка `is_super_admin`;
- в коде рядом с использованием должна быть явная пометка, что это «system‑level» доступ и осознанное исключение из правил 5.2.

### 3.2. `/api/cron/*`

- Контекст: фоновые задачи без пользовательской сессии (Vercel Cron и пр.).
- Допустимо:
  - создавать service client напрямую;
  - обходить RLS для обхода всех бизнесов/данных согласно задаче.
- Требования:
  - эндпоинты cron должны быть защищены (секрет/ограничение по source IP и т.п.);
  - при работе c бизнесами всё равно желательно явно указывать `biz_id` (чтобы код был предсказуем и безопасен при будущих изменениях модели).

### 3.3. Webhooks и системные интеграции

- Пример: `api/webhooks/whatsapp`.
- Контекст берётся **из данных домена** (booking, profile и т.п.), а не из сессии менеджера.
- Разрешается использовать service client напрямую, если:
  - входящий запрос аутентифицирован на уровне внешней системы (подписанный webhook и т.п.);
  - бизнес определяется по данным домена и/или по конфигурации.

При этом всё равно действуют требования из аудита:

- для таблиц с `biz_id` — явные фильтры/проверки принадлежности;
- никакой подстановки `biz_id` из необработанного тела запроса.

### 3.4. Библиотеки, которые сами определяют контекст

Разрешён прямой service client в:

- `lib/authCheck.ts` — принимает `bizId` и гарантирует фильтрацию внутри;
- `lib/bizContextResolver.ts`, `lib/staffRoleSync.ts` — определяют или синхронизируют контекст (работают «под капотом» auth‑слоя);
- `lib/apiMetrics.ts` — системная запись метрик.

**Требование:** эти библиотеки не должны использоваться напрямую в UI/route‑коде как способ «обойти» `withManagerContext`. Они либо вызываются из самой обёртки, либо из других auth‑утилит.

---

## 4. Анти‑паттерны (так делать нельзя)

**Перечисление и примеры:**

- **Создавать service client в маршруте дашборда без `withManagerContext`:**
  ```ts
  // ❌ Нельзя
  const admin = getServiceClient();
  const { bizId } = await getBizContextForManagers(); // дублирование, возможна рассинхронизация
  ```
  Использовать только `withManagerContext(req, 'Scope', async ({ admin, bizId }) => { ... })`.

- **Брать `bizId` из query/body без проверки прав:**
  ```ts
  // ❌ Нельзя
  const bizId = searchParams.get('biz_id') ?? body.biz_id;
  const { data } = await admin.from('branches').select('*').eq('biz_id', bizId);
  ```
  `bizId` должен приходить только из `withManagerContext` или из предварительно проверенных данных (например, booking.biz_id после проверки доступа к бронированию).

- **Читать/обновлять сущность по `id` без проверки принадлежности к бизнесу:**
  ```ts
  // ❌ Нельзя — сотрудник может быть из другого бизнеса
  const { data } = await admin.from('staff').select('*').eq('id', staffId).single();
  await admin.from('staff').update({ full_name: body.name }).eq('id', staffId);
  ```
  Сначала `checkResourceBelongsToBiz(admin, 'staff', staffId, bizId)` или запрос с `.eq('biz_id', bizId).eq('id', staffId)`.

- **Вставка с `biz_id` из запроса пользователя:**
  ```ts
  // ❌ Нельзя
  await admin.from('promotions').insert({ ...body, biz_id: body.biz_id });
  ```
  Всегда подставлять `biz_id: bizId` из контекста обёртки.

- **Запрос к таблице с `biz_id` без фильтра:**
  ```ts
  // ❌ Нельзя — вернёт данные всех бизнесов
  const { data } = await admin.from('staff_shifts').select('*').eq('staff_id', staffId);
  ```
  Добавить `.eq('biz_id', bizId)` (и убедиться, что staff принадлежит bizId).

- **Использовать service client в клиентском коде или в странице без получения контекста на сервере:**  
  Service client создаётся только на сервере (route, RSC); в компонентах использовать только данные, полученные на сервере с уже применённой фильтрацией.

Любое использование service client, не попадающее под правила этого гайда, должно рассматриваться как **ошибка безопасности**, а не как допустимое упрощение.

---

## 5. Как применять этот гайд на практике

1. **Создаёте новый route для кабинета (`/api/dashboard/*`, `/api/staff/*` и т.п.)**:
   - начинайте реализацию с `withManagerContext`;
   - используйте `supabase` там, где хватает RLS, и `admin` только там, где RLS мешает.
2. **Рефакторите старый код с `getServiceClient`/`getBizContextForManagers`**:
   - заменяете связку `getBizContextForManagers` + `getServiceClient` на `withManagerContext`;
   - оставляете только `bizId`, `supabase`, `admin` из контекста;
   - проверяете, что все запросы через `admin` соответствуют требованиям аудита.
3. **Добавляете исключение**:
   - сначала убедитесь, что кейс действительно относится к admin/cron/webhook/low‑level lib;
   - добавьте комментарий в код и, при необходимости, расширьте раздел 3 этого документа.

За общими примерами и списком всех текущих использований service client обращайтесь к `docs/SERVICE_CLIENT_AND_BIZ_FILTERS_AUDIT.md`.

