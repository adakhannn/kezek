# API: административные операции

Статус: справочник исходников, общая статическая сверка **2026-11-01**, ENG-31 обновлён и проверен изолированно **2026-11-11**; runtime с remote-сервисами **NOT_RUN**. Владелец: maintainers API. Аудитория: разработчики и эксплуатация. Цель — выбрать правильный метод, разобрать реальный ответ и видеть границы контроля до интеграции. Для исполнения нужен отдельно разрешенный доступ к среде и конкретной операции; destructive/admin actions в рамках этой сверки не выполнялись.

Покрытие: **59 путей / 74 явно экспортированных метода**. Это все `/admin/api/*` и остаток `/api/admin/*`; пять ранее описанных admin endpoints находятся в [AUTH_AND_INTEGRATIONS.md](AUTH_AND_INTEGRATIONS.md). Общий каталог — [API_DOCUMENTATION.md](../../API_DOCUMENTATION.md); правила изменений — [CONTRIBUTING.md](../../CONTRIBUTING.md), открытые проблемы — [ENGINEERING_FINDINGS.md](../ENGINEERING_FINDINGS.md).


Обновление 9–10 ноября 2026: прежние unbound VIEW-проверки переведены на общий caller-bound helper; 15 отрицательных [route cases](../../apps/web/src/__tests__/api/admin/caller-bound-role-gates.test.ts) отвергают обычного caller даже при наличии чужого global super_admin. Metrics, metrics/stats, metrics/auth-flow и finance-logs используют [adminHttpAccess](../../apps/web/src/lib/adminHttpAccess.ts) до service client: 401 без identity, 403 без global роли, 503 при ошибке проверки. [Изолированные access tests](../../apps/web/src/__tests__/api/admin/privileged-diagnostics-access.test.ts) прошли; реальный deployment/RLS этим не подтвержден.

## Как читать таблицы

`R(fields)` — HTTP 200, JSON с `ok:true` и перечисленными полями **в корне**; `R()` — только `{"ok":true}`. `D(data)` — HTTP 200, `{"ok":true,"data":...}`. Это условная запись shape, не JSON example. В большинстве legacy routes failure — `{"ok":false,"error":"текст или код"}`; ряд operations возвращает `message` или `code` вместо/в дополнение к `error`. Это неоднородное API, не единый SDK response type. Когда указан тип/return из source, он определяет вложенные поля.

Во всех строках с проверкой пользователя возможен 401; после проверки роли — 403. Большинство legacy handlers возвращает DB/provider message в `error` с 400 и unexpected exception с 500. Таблицы выделяют дополнительные ветки; точный код — по source link. У routes без catch/`withErrorHandler` thrown error не имеет гарантированного JSON envelope. Общие helpers: [apiErrorHandler](../../apps/web/src/lib/apiErrorHandler.ts), [validation](../../apps/web/src/lib/validation/apiValidation.ts), [routeParams](../../apps/web/src/lib/routeParams.ts).

| Auth в таблицах | Реально исполняемый контроль |
| --- | --- |
| `CURRENT` | Подтверждённый cookie user + [adminAccess](../../apps/web/src/lib/adminAccess.ts): `is_super_admin()` вызывается тем же session client без actor-параметра. Принимается только boolean true без ошибки; identity задаёт `auth.uid()` в SQL |
| `RPC` | Cookie user + boolean result `is_super_admin()` через cookie client; permission decision делегирован БД |
| `BIZ` | Cookie user, затем `is_super_admin()` либо `has_role(owner/admin, business id)` |
| `DB` | Нет явной проверки пользователя/роли до query; используется cookie client и контроль делегирован RPC/RLS |

Канонический `is_super_admin()` определён в [maintenance ACL migration](../../supabase/migrations/20261110132000_privileged_maintenance_acl.sql): global role с platform scope, `super_admins_legacy` либо legacy `user_roles` с `biz_id IS NULL` и super_admin key. Чужой или tenant-scoped super_admin не разрешает доступ. Локальные SQL/API tests не доказывают deployed migration. Остальные RPC остаются отдельными зависимостями. Layout страницы не заменяет HTTP authorization; [middleware](../../apps/web/src/middleware.ts) не устанавливает общий admin role gate.

**Limiter:** на всех `/admin/api/*` в этом документе нет `withRateLimit`. У трех `/api/admin/ratings/*` лимиты указаны отдельно. Это не подтверждает внешние gateway/WAF правила. `OPTIONS` ниже — явно написанные handlers; неявные ответы framework не считаются отдельными контрактами.

## Пользователи

<!-- api-contract: GET /admin/api/users/list -->
<!-- api-contract: GET /admin/api/users/search -->
<!-- api-contract: POST /admin/api/users/create -->
<!-- api-contract: POST /admin/api/users/[id]/update-basic -->
<!-- api-contract: PUT /admin/api/users/[id]/update-basic -->
<!-- api-contract: POST /admin/api/users/[id]/toggle-super -->
<!-- api-contract: POST /admin/api/users/[id]/set-password -->
<!-- api-contract: POST /admin/api/users/[id]/send-magic-link -->
<!-- api-contract: POST /admin/api/users/[id]/suspend -->
<!-- api-contract: POST /admin/api/users/[id]/delete -->
<!-- api-contract: DELETE /admin/api/users/[id]/delete -->

| METHOD / path и source | Auth / input | Успех и ошибки | Side effects и ограничения |
| --- | --- | --- | --- |
| GET [`/admin/api/users/list`](../../apps/web/src/app/admin/api/users/list/route.ts) | `CURRENT`; query schema: `q` trim/lowercase; `page` 1..1000 default 1, `perPage` 1..200 default 50, `status` all/active/blocked default all | `R(items,page,perPage,total)`; `UserListItem`: id, full_name, email, phone, last_sign_in_at, is_super, is_blocked, block_reason. 400 query/DB; auth codes `UNAUTHORIZED`/`FORBIDDEN` | Auth `listUsers` сначала выбирает страницу, **затем** выполняется q/status filter. `total=(page-1)*perPage+items.length` — не глобальное количество совпадений. `is_super` читает bounded (до 200 IDs) service-only `read_platform_admin_states`: verified actor повторно проверяется по трём stores; неполный/невалидный ответ завершается ошибкой, не false-флагами. Profile/suspension query errors пока могут давать неполные поля |
| GET [`/admin/api/users/search`](../../apps/web/src/app/admin/api/users/search/route.ts) | `RPC`; optional `q` trim, без max length | `R(items)` из `auth_users_view`: id,email,phone,full_name; 400 DB | До 20 строк, поиск OR/ilike email/phone/name; q вставляется в PostgREST filter string без отдельного escaping. Это другой поиск, чем users/list |
| POST [`/admin/api/users/create`](../../apps/web/src/app/admin/api/users/create/route.ts) | `RPC`; JSON email и/или phone, full_name, password. Email format; phone E.164. При email password минимум 8 после trim; phone-only запрещает password | `R(id,method)`; method `email_password` или `phone_otp`. 400 validation/role RPC; **409 для любого createUser error**; 500 unexpected | Создает Auth user с подтвержденными переданными email/phone, при имени upsert profile. Это не отправка OTP. Profile upsert error не проверяется; invalid JSON заменяется пустым объектом |
| POST, PUT [`/admin/api/users/[id]/update-basic`](../../apps/web/src/app/admin/api/users/[id]/update-basic/route.ts) | `CURRENT`; path id; JSON optional full_name/email/phone, trim, без schema email/phone | `R()`; 400 missing id/role/update; 404 `user_not_found` | Меняет Auth user через service client. Пропущенное/пустое имя становится null metadata; email/phone null превращаются в undefined и не очищают старые значения. Profiles явно не обновляет |
| POST [`/admin/api/users/[id]/toggle-super`](../../apps/web/src/app/admin/api/users/[id]/toggle-super/route.ts) | `CURRENT`; UUID path ID, strict JSON `{makeSuper:boolean}`, обязательное поле | `D({isSuperAdmin:boolean})`; 400 input, 403 повторная SQL-проверка actor, 404 target, 409 последний admin, 503 неподтверждённый исход | Service-only [atomic command](../../supabase/migrations/20261110134000_platform_admin_commands.sql) под общим lock выдаёт canonical global role или снимает её из всех трёх global stores. Tenant roles сохраняются. Самоотзыв последнего admin запрещён внутри этой команды; ENG-31 assignment triggers дополнительно запрещают выдачу роли suspended/pending-lifecycle target |
| POST [`/admin/api/users/[id]/set-password`](../../apps/web/src/app/admin/api/users/[id]/set-password/route.ts) | `RPC`; JSON password string, trim length≥8; parse выполняется до try/auth | `R()`; 400 validation/role/provider, 500 caught exception. Parse вне catch не обещает этот envelope | Admin Auth password reset. `context.params` читается без await; async params не доказаны работающими. Сессии отдельно не отзываются |
| POST [`/admin/api/users/[id]/send-magic-link`](../../apps/web/src/app/admin/api/users/[id]/send-magic-link/route.ts) | `RPC`; path id, body игнорируется | `R(link)` с action_link либо null; 400 role/getUser/no email/generateLink | Вызывает Auth `generateLink` с redirect `<SITE>/auth/callback?next=/admin`, возвращает секретную ссылку. В коде нет отдельной отправки письма; комментарий про SMTP не доказывает доставку. Params читаются без await |
| POST [`/admin/api/users/[id]/suspend`](../../apps/web/src/app/admin/api/users/[id]/suspend/route.ts) | `CURRENT`; UUID path ID; strict JSON `{block:boolean,reason?:string}`; reason ≤500; malformed JSON/coercion/unknown fields → 400 | `R(blocked:boolean)`; 400 self/input, 403 actor, 404 target, 409 protected/pending, 503 unconfirmed | [Lifecycle service](../../apps/web/src/lib/userLifecycleHttpService.ts) prepares a service-only durable command, calls Auth ban/unban, and confirms its transaction receipt. Roles and staff identity survive suspension; unblock requires a fresh login. See lifecycle protocol below |
| POST, DELETE [`/admin/api/users/[id]/delete`](../../apps/web/src/app/admin/api/users/[id]/delete/route.ts) | `CURRENT`; UUID path ID; no body; cannot target self; global administrators in all three stores protected | `R()`; 400 self/input, 403 actor, 404 target, 409 owner/protected/pending, 503 unconfirmed | Auth DELETE and dependent FK cleanup share one transaction. Transfer business ownership first. Staff row retained inactive, branch-admin access removed, booking client reference detached; finance/history retained. Failed FK rolls back all changes; completed repeat returns durable receipt |

## Каталог и назначения ролей

<!-- api-contract: GET /admin/api/roles/list -->
<!-- api-contract: POST /admin/api/roles/list -->
<!-- api-contract: POST /admin/api/roles/create -->
<!-- api-contract: POST /admin/api/roles/[id]/update -->
<!-- api-contract: PATCH /admin/api/roles/[id]/update -->
<!-- api-contract: PUT /admin/api/roles/[id]/update -->
<!-- api-contract: POST /admin/api/roles/[id]/delete -->
<!-- api-contract: DELETE /admin/api/roles/[id]/delete -->
<!-- api-contract: POST /admin/api/roles/assign -->
<!-- api-contract: POST /admin/api/roles/add -->
<!-- api-contract: POST /admin/api/roles/set-many -->

| METHOD / path и source | Auth / input | Успех и ошибки | Side effects и ограничения |
| --- | --- | --- | --- |
| GET, POST [`/admin/api/roles/list`](../../apps/web/src/app/admin/api/roles/list/route.ts) | `CURRENT`; body/query не используются | `R(items)` с `roles.*`, sort system desc/key asc; 400 DB | Только чтение, без pagination |
| POST [`/admin/api/roles/create`](../../apps/web/src/app/admin/api/roles/create/route.ts) | `CURRENT`; key regex `[a-z0-9_-]{2,32}`, непустое name; optional description | `R(id)`; 400 validation/DB, duplicate не выделен в 409 | Insert role через cookie client; key super_admin задает `is_system:true`, прочие false |
| POST, PATCH, PUT [`/admin/api/roles/[id]/update`](../../apps/web/src/app/admin/api/roles/[id]/update/route.ts) | `CURRENT`; path id; optional name/description, trim/empty→null | `R()` даже при пустом patch или update без совпавшей строки; 400 missing id/DB | Меняет только name/description, не key/is_system. Params извлекаются через getRouteParam с поддержкой Promise |
| POST, DELETE [`/admin/api/roles/[id]/delete`](../../apps/web/src/app/admin/api/roles/[id]/delete/route.ts) | `CURRENT`; id, body игнорируется | `R()`; 404 missing role; 400 system role/FK/DB | Удаляет nonsystem role; FK error преобразуется в сообщение о назначениях. Params извлекаются через getRouteParam с поддержкой Promise |
| POST [`/admin/api/roles/assign`](../../apps/web/src/app/admin/api/roles/assign/route.ts) | Только cookie user в TS; JSON user_id, optional biz_id→null, role; schema нет | `R()`; 401 auth, 400 RPC message; общего catch нет | Делегирует `grant_role_rpc(p_user,p_biz,p_role)` cookie client. Не приписывать этому route отдельный super_admin gate: он зависит от неизвестного здесь SQL RPC |
| POST [`/admin/api/roles/add`](../../apps/web/src/app/admin/api/roles/add/route.ts) | `RPC`; user_id,biz_id обязательны; role из owner/manager/staff/admin/client | `R()`; 400 invalid input, profile/business отсутствуют, DB | Service upsert **всего body** в user_roles по `biz_id,user_id,role`; schema не отсекает лишние поля. Uses legacy `role` column, в отличие от role_id routes |
| POST [`/admin/api/roles/set-many`](../../apps/web/src/app/admin/api/roles/set-many/route.ts) | `RPC`; user_id,biz_id; roles array из owner/manager/staff/admin/client, пустой разрешен | `R()`; 400 validation/delete/insert | Удаляет все business roles пользователя, затем вставляет новые через legacy `role`. Нет транзакции; ошибка insert оставляет уже удаленные роли |

## Категории

<!-- api-contract: GET /admin/api/categories/list -->
<!-- api-contract: GET /admin/api/categories/existing -->
<!-- api-contract: POST /admin/api/categories/create -->
<!-- api-contract: POST /admin/api/categories/[id]/update -->
<!-- api-contract: POST /admin/api/categories/[id]/delete -->
<!-- api-contract: DELETE /admin/api/categories/[id]/delete -->

| METHOD / path и source | Auth / input | Успех и ошибки | Side effects и ограничения |
| --- | --- | --- | --- |
| GET [`/admin/api/categories/list`](../../apps/web/src/app/admin/api/categories/list/route.ts) | `RPC`; без input | `R(items)` — необработанный result `categories_with_usage_v2` либо []; 400 RPC; общего catch нет | Чтение через cookie RPC; вложенный deployed shape не определен в route и не выдуман здесь |
| GET [`/admin/api/categories/existing`](../../apps/web/src/app/admin/api/categories/existing/route.ts) | `RPC`; без input | `D(string[])`; 400 DB | Собирает unique trimmed categories из первых максимум 10000 businesses, сортирует. Это не полный catalog categories и не полный scan при большей базе |
| POST [`/admin/api/categories/create`](../../apps/web/src/app/admin/api/categories/create/route.ts) | `RPC`; name_ru required, optional slug/is_active; slug default transliteration name, regex `[a-z0-9-]{2,}` | `R(id)`; 400 validation/DB, 409 duplicate slug | Insert categories; is_active default true; полного runtime body schema нет |
| POST [`/admin/api/categories/[id]/update`](../../apps/web/src/app/admin/api/categories/[id]/update/route.ts) | `RPC`; UUID id; optional name_ru/slug/is_active/propagateSlug. Переданное имя не пустое; slug null/empty генерируется из имени | `R(updated,slug)`; 404 category; 400 validation/DB; 409 duplicate | При propagateSlug вызывает `cat_replace_slug` **до** update категории. Две операции не атомарны; ошибка update может оставить замененные связи. Empty patch → updated=false |
| POST, DELETE [`/admin/api/categories/[id]/delete`](../../apps/web/src/app/admin/api/categories/[id]/delete/route.ts) | `RPC`; id; optional force default false, invalid JSON→{} | `R(removed)` — число business references; 404 category; 400 used-without-force/DB | force сначала вызывает `cat_remove_slug`, потом удаляет category. Нет общей транзакции; `removed` не счетчик удаленных categories |

## Бизнесы и филиалы

Public contacts — `contact_phone`, `contact_whatsapp`, `contact_email`, `website_url`; правила — [validatePublicContacts](../../apps/web/src/lib/businessContacts.ts): нормализация телефонов/E.164, email до 254, HTTPS website. Helper возвращает **все четыре поля**, пропущенные становятся null. Это важно для partial update.

<!-- api-contract: POST /admin/api/businesses/create -->
<!-- api-contract: PATCH /admin/api/businesses/[id]/update -->
<!-- api-contract: POST /admin/api/businesses/[id]/branch-limit -->
<!-- api-contract: POST /admin/api/businesses/[id]/delete -->
<!-- api-contract: POST /admin/api/businesses/[id]/branches/create -->
<!-- api-contract: OPTIONS /admin/api/businesses/[id]/branches/create -->
<!-- api-contract: POST /admin/api/businesses/[id]/branches/[branchId]/update -->
<!-- api-contract: PATCH /admin/api/businesses/[id]/branches/[branchId]/update -->
<!-- api-contract: PUT /admin/api/businesses/[id]/branches/[branchId]/update -->
<!-- api-contract: OPTIONS /admin/api/businesses/[id]/branches/[branchId]/update -->
<!-- api-contract: POST /admin/api/businesses/[id]/branches/[branchId]/delete -->
<!-- api-contract: DELETE /admin/api/businesses/[id]/branches/[branchId]/delete -->
<!-- api-contract: GET /admin/api/businesses/[id]/branches/[branchId]/schedule -->
<!-- api-contract: POST /admin/api/businesses/[id]/branches/[branchId]/schedule -->

| METHOD / path и source | Auth / input | Успех и ошибки | Side effects и ограничения |
| --- | --- | --- | --- |
| POST [`/admin/api/businesses/create`](../../apps/web/src/app/admin/api/businesses/create/route.ts) | `RPC`; [ManualBusinessCreationInput](../../apps/web/src/lib/manualBusinessCreationService.ts): name 2..160, slug derived/max80, optional phone, непустой categories array, branch_limit integer1..1000, reason10..1000, acknowledge_manual=true, optional duplicate_override | **201** `R(id)`; failure `{ok:false,code,error?,duplicates?}`; 400 validation/query; 409 slug_taken/possible_duplicate; 500 audit_failed/unexpected_error | Создает approved business без owner и audit context. Categories проверяются active; duplicate searches максимум10 name+10 phone matches. При audit failure делает best-effort delete business, не транзакцию. normalizePhone может вернуть null; это не schema, гарантирующая отказ на каждый некорректный phone |
| PATCH [`/admin/api/businesses/[id]/update`](../../apps/web/src/app/admin/api/businesses/[id]/update/route.ts) | `RPC`; id; строгий непустой JSON по [businessUpdateSchema](../../apps/web/src/lib/validation/businessUpdateSchemas.ts): optional name,slug,categories,address,phones,is_approved,contacts | `D(updated row)`; 404 missing/fetch error; 409 slug; 400 JSON/schema/validation/update | Только переданные поля; omitted contacts сохраняются. Categories null/[] очищают; phone list нормализуется без E.164 validation. Boolean только boolean, неизвестные поля и пустой patch отклоняются |
| POST [`/admin/api/businesses/[id]/branch-limit`](../../apps/web/src/app/admin/api/businesses/[id]/branch-limit/route.ts) | `RPC`; JSON branch_limit integer1..1000 | `R(branch_limit)`; 400 input/DB; 409 ниже текущего числа branches; catch отсутствует | Count и update отдельные; не доказывает отсутствие race с созданием branch. Update не проверяет existence affected row |
| POST [`/admin/api/businesses/[id]/delete`](../../apps/web/src/app/admin/api/businesses/[id]/delete/route.ts) | `RPC`; path id, body не читается | `R()`; 400 RPC error | Service RPC `force_delete_business_and_downgrade_owner(p_biz_id)`. HTTP не имеет preview/undo; точный каскад и downgrade зависят от отсутствующего локального определения SQL |
| POST [`/admin/api/businesses/[id]/branches/create`](../../apps/web/src/app/admin/api/businesses/[id]/branches/create/route.ts) | `RPC`; name required; optional address,is_active,lat/lon, directory_links,inherit_business_contacts,contacts. Если одна координата задана, нужны обе, затем validateLatLon | `R(id)`; 400 validation/DB; 409 branch limit через [branchCreateError](../../apps/web/src/lib/branchCreateService.ts) | Insert branch, coords EWKT; is_active default true, inheritance default true. [resolveInitialDirectoryLinks](../../apps/web/src/lib/branchCreateService.ts) может взять links исходной заявки для первого филиала |
| OPTIONS [`/admin/api/businesses/[id]/branches/create`](../../apps/web/src/app/admin/api/businesses/[id]/branches/create/route.ts) | Без auth/input | **204**, пустое тело | Не выполняет создание и не добавляет CORS headers в handler |
| POST, PATCH, PUT [`/admin/api/businesses/[id]/branches/[branchId]/update`](../../apps/web/src/app/admin/api/businesses/[id]/branches/[branchId]/update/route.ts) | [caller-bound global-super](../../apps/web/src/lib/adminHttpAccess.ts); awaited path params; [branchUpdateSchema](../../apps/web/src/lib/validation/businessUpdateSchemas.ts), общий [updateBranch](../../apps/web/src/lib/branchUpdateService.ts) | `R(updated:true)`; 401/403/503 access; 404 missing branch; 400 JSON/schema/validation/DB | Все три метода имеют PATCH semantics: omitted поля сохраняются, null очищает nullable поля; lat/lon только парой. Пустой patch отклоняется. Проверка принадлежности и update ограничены branch_id + biz_id; affected rows после precheck отдельно не проверяются |
| OPTIONS [`/admin/api/businesses/[id]/branches/[branchId]/update`](../../apps/web/src/app/admin/api/businesses/[id]/branches/[branchId]/update/route.ts) | Без auth/input | **204**, пустое тело | Нет mutation/CORS headers |
| POST, DELETE [`/admin/api/businesses/[id]/branches/[branchId]/delete`](../../apps/web/src/app/admin/api/businesses/[id]/branches/[branchId]/delete/route.ts) | `RPC`; ids URL; body не используется | `R()`; 400 BRANCH_NOT_IN_THIS_BUSINESS/HAS_SERVICES/HAS_STAFF/HAS_BOOKINGS, для bookings details; 400 FK/DB | Проверяет active services/staff и любые non-cancelled bookings. До удаления branch удаляет cancelled bookings/assignments/schedule rules, может переместить inactive staff. Ошибки части шагов только логируются. Последний FK failure не откатывает выполненное; count errors не везде проверены |
| GET [`/admin/api/businesses/[id]/branches/[branchId]/schedule`](../../apps/web/src/app/admin/api/businesses/[id]/branches/[branchId]/schedule/route.ts) | `RPC`; ids URL; проверка branch belongs biz | `R(schedule)` с day_of_week,intervals,breaks; 404 branch; 400 DB | Читает branch_working_hours, sort day_of_week, без изменения |
| POST [`/admin/api/businesses/[id]/branches/[branchId]/schedule`](../../apps/web/src/app/admin/api/businesses/[id]/branches/[branchId]/schedule/route.ts) | `RPC`; JSON schedule array, `ScheduleItem` в route: day_of_week, intervals/start/end, breaks/start/end | `R()`; 404 branch; 400 bad array/DB; 409 SCHEDULE_BOOKING_CONFLICT в explicit mode | При [explicitSchedulingEnabled](../../apps/web/src/lib/scheduling/config.ts) вызывает replace_branch_schedule с actor. Legacy: delete старых rows, затем insert рабочих дней; delete error не проверяется, общей транзакции нет. Пустое/неполное расписание не имеет одинаковых гарантий в двух режимах |

## Участники бизнеса

<!-- api-contract: GET /admin/api/businesses/[id]/members/list -->
<!-- api-contract: POST /admin/api/businesses/[id]/members/add -->
<!-- api-contract: POST /admin/api/businesses/[id]/members/invite -->
<!-- api-contract: POST /admin/api/businesses/[id]/members/grant -->
<!-- api-contract: POST /admin/api/businesses/[id]/members/revoke -->
<!-- api-contract: POST /admin/api/businesses/[id]/members/demote -->

| METHOD / path и source | Auth / input | Успех и ошибки | Side effects и ограничения |
| --- | --- | --- | --- |
| GET [`/admin/api/businesses/[id]/members/list`](../../apps/web/src/app/admin/api/businesses/[id]/members/list/route.ts) | `DB`; biz UUID, **нет getUser/role check в route** | `R(items)` (`Item`: user_id,email,phone,full_name,roles[]); 400 id/DB, 403 по тексту fallback error | Сначала members_of_biz; при RPC error делает fallback view query. Ошибка permission RPC сама по себе не останавливает fallback. Без pagination, ACL зависит от SQL/view |
| POST [`/admin/api/businesses/[id]/members/add`](../../apps/web/src/app/admin/api/businesses/[id]/members/add/route.ts) | `RPC`; email или нормализуемый phone, optional full_name, role_key, sendTempPassword | `R(created_user,sent_temp_email,sent_temp_sms)`; 400 input/Auth/roles; 500 missing created id/provider exception | Находит Auth user перебором до10×1000 или создает; role_key super_admin явно запрещен, остальные ищет в roles (строгой enum schema нет). Назначает role_id. При sendTempPassword **сбрасывает password даже существующему user** и отправляет email/SMS; неатомарно, отсутствие подтвержденной доставки не откатывает reset |
| POST [`/admin/api/businesses/[id]/members/invite`](../../apps/web/src/app/admin/api/businesses/[id]/members/invite/route.ts) | `BIZ`; biz UUID; email/phone хотя бы одно, formats email/E.164; optional full_name,roles[] default client | `R()`; 400 validation/query/create/insert | Ищет user по view либо создает confirmed Auth user со случайным password, добавляет роли по role_id. Unknown role keys пропускает; runtime allowlist roles нет. **Письмо/SMS не отправляет:** отправка только TODO. Params без await; возможны частичные записи |
| POST [`/admin/api/businesses/[id]/members/grant`](../../apps/web/src/app/admin/api/businesses/[id]/members/grant/route.ts) | `BIZ`; user_id nonempty; role_key default client. Type union в `Body` не runtime allowlist | `R()`; 400 user/role/DB; duplicate23505 игнорируется | Insert role_id через service. Для owner отдельно update businesses.owner_id, error не проверяет. Не снимает предыдущих owners и не гарантирует синхронизацию двух записей |
| POST [`/admin/api/businesses/[id]/members/revoke`](../../apps/web/src/app/admin/api/businesses/[id]/members/revoke/route.ts) | `BIZ`; user_id nonempty; role_key default client, без runtime enum | `R()`; 400 user/role/delete | Удаляет конкретную business role, для owner отдельно очищает matching owner_id, error не проверяет. Нет guard последнего owner или affected-row proof |
| POST [`/admin/api/businesses/[id]/members/demote`](../../apps/web/src/app/admin/api/businesses/[id]/members/demote/route.ts) | `BIZ`; biz и user_id UUID | `R()`; 400 UUID/role/delete/upsert (может содержать SQL index hint) | Удаляет все business roles кроме client, затем upsert client. Не обновляет businesses.owner_id/staff и не транзакционен |

## Владельцы бизнеса

<!-- api-contract: GET /admin/api/businesses/[id]/owner/list -->
<!-- api-contract: POST /admin/api/businesses/[id]/owner/save -->
<!-- api-contract: PUT /admin/api/businesses/[id]/owner/save -->
<!-- api-contract: POST /admin/api/businesses/[id]/owner/update -->
<!-- api-contract: POST /admin/api/businesses/[id]/owner/set -->
<!-- api-contract: POST /admin/api/businesses/[id]/owner/upsert -->

| METHOD / path и source | Auth / input | Успех и ошибки | Side effects и ограничения |
| --- | --- | --- | --- |
| GET [`/admin/api/businesses/[id]/owner/list`](../../apps/web/src/app/admin/api/businesses/[id]/owner/list/route.ts) | `RPC`; biz id, body/query не используются | `R(owners)`; `OwnerInfo`: id,email,phone,full_name; 400 role/DB | Читает role_id owners; последовательно делает Auth+profile lookup каждому. Ошибочных пользователей пропускает, 200 может быть неполным. Без pagination |
| POST, PUT [`/admin/api/businesses/[id]/owner/save`](../../apps/web/src/app/admin/api/businesses/[id]/owner/save/route.ts) | `RPC`; JSON user_ids optional→[]; фильтрует непустые строки, UUID/schema/max size нет | `R(owner_ids)`; 404 Auth user; 400 USER_SUSPENDED/role/delete/insert | Проверяет users, удаляет все owner roles, вставляет выбранные, owner_id ставит первому или null. Пустой/missing user_ids снимает всех owners. Без транзакции; owner_id failure только log; duplicate IDs не удаляет |
| POST [`/admin/api/businesses/[id]/owner/update`](../../apps/web/src/app/admin/api/businesses/[id]/owner/update/route.ts) | `RPC`; optional full_name,email,phone, trim, пустое игнорирует | `R(updated:false)` либо `R(updated:true,user)`; 400 no owner/DB/Auth | Обновляет Auth user из businesses.owner_id, не список owner roles. Пустыми значениями очистить поля нельзя |
| POST [`/admin/api/businesses/[id]/owner/set`](../../apps/web/src/app/admin/api/businesses/[id]/owner/set/route.ts) | `RPC`; email или phone, optional full_name, schema formats нет | `R(owner_id,replaced)`; 400 DB; validation/create exceptions обычно 500 | Сначала пытается создать confirmed Auth user со случайным password; при duplicate ищет до10×1000 users. Затем owner_id, legacy role upsert, снятие прежней legacy owner role. Неатомарно, пароль не возвращает/не отправляет |
| POST [`/admin/api/businesses/[id]/owner/upsert`](../../apps/web/src/app/admin/api/businesses/[id]/owner/upsert/route.ts) | `RPC`; email или phone, optional full_name; env presence guard до auth | `R(owner_id)`; 400 DB/role; 500 ENV/create/validation exceptions | Похожее create/lookup до10×1000, owner_id + legacy role; **старую owner role не снимает**. Params без await; не атомарно. Это не alias owner/set или owner/save |

## Заявки

<!-- api-contract: GET /admin/api/role-applications -->
<!-- api-contract: POST /admin/api/role-applications/[id]/status -->
<!-- api-contract: POST /admin/api/business-applications/[id]/status -->

| METHOD / path и source | Auth / input | Успех и ошибки | Side effects и ограничения |
| --- | --- | --- | --- |
| GET [`/admin/api/role-applications`](../../apps/web/src/app/admin/api/role-applications/route.ts) | `CURRENT`; optional status, empty/all=no filter; enum нет | `R(items)` из выбранных application fields + businesses(name,slug) + active_block_id; errors `{ok:false,message}`, 401/403/400; catch отсутствует | До200 newest applications и активные блокировки этих заявителей. PII/evidence links в output; не полный список при большем объеме |
| POST [`/admin/api/role-applications/[id]/status`](../../apps/web/src/app/admin/api/role-applications/[id]/status/route.ts) | `CURRENT`; action approve/reject/unblock; note trim≤1000, block_days numeric0/7/30/90 иначе0; block_id для unblock | `R()`; errors `{ok:false,message}`: 400 JSON/action/role/DB, 404 application/block, 409 processed/released. Thrown service errors не обернуты | [Service](../../apps/web/src/lib/businessRoleApplicationService.ts) approve вставляет role, owner_id и status отдельными writes; staff approve запрещен этим route. Reject/unblock идут через [policy RPC adapters](../../apps/web/src/lib/applicationPolicy.ts). Owner approve вызывает [уведомление](../../apps/web/src/lib/businessRoleApplicationNotificationService.ts); failure логируется после успешной mutation |
| POST [`/admin/api/business-applications/[id]/status`](../../apps/web/src/app/admin/api/business-applications/[id]/status/route.ts) | `RPC`; status new/contacted/approved/rejected; note≤1000, block_days0/7/30/90 для reject | Approved: `R(businessId,alreadyCreated)`; прочие `R()`; errors `{ok:false,error}`: 400 input/DB, 404 missing application при approval, 409 policy; catch отсутствует | [Approval service](../../apps/web/src/lib/businessApplicationService.ts) создает approved business, category при необходимости, owner role, связывает application; уже созданный business использует повторно. Compensation deletes best-effort, не единая транзакция. Reject через policy; new/contacted простой update без проверки affected rows. Approval может отправить [уведомление](../../apps/web/src/lib/businessRoleApplicationNotificationService.ts), failure не откатывает результат |

## Рейтинги

<!-- api-contract: GET /api/admin/ratings/jobs -->
<!-- api-contract: GET /api/admin/ratings/debug-entities -->
<!-- api-contract: POST /api/admin/ratings/recalculate -->
<!-- api-contract: GET /admin/api/rating-config -->
<!-- api-contract: POST /admin/api/rating-config -->

| METHOD / path и source | Auth / input | Успех и ошибки | Side effects и ограничения |
| --- | --- | --- | --- |
| GET [`/api/admin/ratings/jobs`](../../apps/web/src/app/api/admin/ratings/jobs/route.ts) | `CURRENT` через [read service](../../apps/web/src/lib/ratingsAdminReadService.ts); без input. Limiter normal/shared30/min | `D({jobs})` через [HTTP](../../apps/web/src/lib/ratingsAdminHttpService.ts); [jobs service](../../apps/web/src/lib/ratingsJobsService.ts) перечисляет поля id,timestamps,created_by,date_from/date_to,scope,status,progress,errors; 400 role query, 500 data query | Последние50 rating_jobs; только чтение, job не запускает |
| GET [`/api/admin/ratings/debug-entities`](../../apps/web/src/app/api/admin/ratings/debug-entities/route.ts) | `CURRENT` через [HTTP](../../apps/web/src/lib/ratingsDebugEntitiesHttpService.ts)/[service](../../apps/web/src/lib/ratingsDebugEntitiesService.ts); days parseInt default7 clamp1..90; normal/shared30/min | `D({days,window_since,with_null_rating,without_metrics_since,recent_errors})`; вложенные lists/totals в service; 400 role query | Читает staff/branches/businesses и metrics без pagination, сравнивает IDs в памяти. Детальные missing lists обрезаны до500/entity, recent errors до100 без фильтра days; query errors могут выглядеть пустыми данными |
| POST [`/api/admin/ratings/recalculate`](../../apps/web/src/app/api/admin/ratings/recalculate/route.ts) | `CURRENT` через [HTTP](../../apps/web/src/lib/ratingsManualRecalculateHttpService.ts); entity_type staff/branch/biz, непустой string entity_id; даты либо обе отсутствуют, либо обе YYYY-MM-DD с реальным календарём и from<=to; critical/shared5/min | `D({ok:true,entity_type,entity_id,action})`; range даёт recalculate_metrics, иначе recalculate_rating; 400 bad_request/role query, 500 thrown/resolved RPC failure | [Service](../../apps/web/src/lib/ratingsManualRecalculateService.ts) проверяет error после каждого RPC и прекращает цепочку при отказе. Range RPC пересчитывает общий интервал, затем выбранный рейтинг. UUID и максимальная длина периода пока не проверяются; несколько RPC не объединены в транзакцию. Audit insert best-effort, ошибки журнала логируются |
| GET [`/admin/api/rating-config`](../../apps/web/src/app/admin/api/rating-config/route.ts) | `CURRENT`; без input | `R(config)` — newest active rating_global_config row либо null; 400 role query, 500 config query | Чтение, не статус пересчета |
| POST [`/admin/api/rating-config`](../../apps/web/src/app/admin/api/rating-config/route.ts) | `CURRENT`; [RatingConfigBody](../../apps/web/src/app/admin/api/rating-config/route.ts): staff_reviews/productivity/loyalty/discipline_weight defaults35/25/20/20, window_days default30; optional recalculate_history, recalculate_days_back | `R(config,recalculate_triggered,recalculate_error?)`; 400 сумма весов не100±0,01/window вне1..365, 500 insert; invalid JSON→defaults | Number coercion без finite/nonnegative/integer validation весов/window. Сначала deactivate old, затем insert new: ошибка первого шага не проверяется, второй не откатывает первый. Optional history RPC awaited при true и numeric days floor1..365; его failure возвращает **200 с recalculate_error** |

## Метрики и состояние системы

<!-- api-contract: GET /admin/api/metrics -->
<!-- api-contract: GET /admin/api/metrics/stats -->
<!-- api-contract: GET /admin/api/metrics/auth-flow -->
<!-- api-contract: GET /admin/api/finance-logs -->
<!-- api-contract: GET /admin/api/system-health -->

Эти URL начинаются с `/admin/api`, а не `/api/admin`; старые комментарии некоторых route-файлов не совпадают с файловым маршрутом. Их описание основано только на чтении source; запрещенные probes/browser access не выполнялись.

| METHOD / path и source | Auth / input | Успех и ошибки | Side effects и ограничения |
| --- | --- | --- | --- |
| GET [`/admin/api/metrics`](../../apps/web/src/app/admin/api/metrics/route.ts) | `CURRENT`. Query schema: endpoint≤255,method≤10,statusCode100..599,date strings YYYY-MM-DD,limit1..1000 default100,offset≥0 default0,errorType≤50,minDuration≥0 | `D(rows)` + root pagination `{total,limit,offset,hasMore}`; 400 validation, 500 DB/exception | Service reads `api_request_metrics.*`, exact count + offset page. Global caller gate выполняется до service-client query; business filter для global read не требуется. Dates проверяют форму, endDate передается напрямую в `lte(created_at)` без расширения до конца суток |
| GET [`/admin/api/metrics/stats`](../../apps/web/src/app/admin/api/metrics/stats/route.ts) | `CURRENT`. endpoint1..255 default `/api/staff/finance`, method1..10 optional; windowMinutes1..1440 default60 | `D(RPC data или {})`; 400 validation, 500 DB/exception. [get_api_metrics_stats SQL](../../supabase/migrations/20260215000000_create_api_metrics_table.sql) возвращает jsonb: endpoint,method,window_minutes,request/status counters,duration statistics,error_rate,error_types,status_codes | Service RPC после global caller gate; adapter не валидирует result shape. SQL error_rate — процент0..100. Не путать с shared Redis `/api/admin/performance/stats`, где errorRate — доля |
| GET [`/admin/api/metrics/auth-flow`](../../apps/web/src/app/admin/api/metrics/auth-flow/route.ts) | `CURRENT`. windowHours1..168 default24 | `D({windowHours,ranges,current,previous,deltas})`; snapshot: started,approved,expired,failed,resolved,pending,approvedRate; 400 validation, 500 DB | 8 exact-count запросов analytics_events для Telegram mobile, две соседние временные windows. Rate=approved/started или null, pending=max(started-resolved,0). Это event counts, не cohort proof |
| GET [`/admin/api/finance-logs`](../../apps/web/src/app/admin/api/finance-logs/route.ts) | `CURRENT`. UUID staffId/bizId/shiftId optional; operationType≤100,logLevel info/warning/error; date form; limit1..1000 default100,offset≥0 | `D(rows)` + root pagination; rows `staff_finance_operation_logs.*` + staff/business join; 400 validation, 500 DB | Global super_admin читает финансовые логи с заданными filters. Exact count; endDate напрямую lte(created_at). Handler access покрыт изолированными отрицательными tests; deployed ACL не проверен |
| GET [`/admin/api/system-health`](../../apps/web/src/app/admin/api/system-health/route.ts) | `CURRENT`; input не используется | `D(SystemHealthResponse)` с inner ok,timestamp,cronJobs,apiMetrics,uiErrors,integrations; 401/403 и общий error handler | DB queries плюс реальные provider GET checks через [integrationsStatusService](../../apps/web/src/lib/integrationsStatusService.ts), без explicit fetch timeout. Многие head:true запросы читают data.length вместо count; UI errors — proxy по API500. Часть errors игнорируется, allMetrics без pagination. 200 и even inner ok не доказывают здоровье всех компонентов |

## Аналитика

<!-- api-contract: POST /admin/api/analytics/track -->
С 2026-11-10 полнота overview/load/promotions/system-overview проверена изолированно; [read adapter](../../apps/web/src/lib/analyticsReportSnapshot.ts), [SQL](../../supabase/migrations/20261110110000_reporting_completeness.sql), [regression runner](../../scripts/test-reporting-completeness.mjs). Это не подтверждение remote deployment или SLA.

<!-- api-contract: GET /admin/api/analytics/overview -->
<!-- api-contract: GET /admin/api/analytics/conversion-funnel -->
<!-- api-contract: GET /admin/api/analytics/load -->
<!-- api-contract: GET /admin/api/analytics/promotions -->
<!-- api-contract: GET /admin/api/system-analytics/overview -->
<!-- api-contract: GET /admin/api/funnel-analytics -->

`MANAGER` в таблице — [getBizContextForManagers](../../apps/web/src/lib/authBiz.ts) и дальнейший выбор текущего business; при явно чужом bizId routes возвращают 403. Это business-scoped endpoints внутри admin path, не обязательно global admin statistics. Локальный cache — [simpleCache](../../apps/web/src/lib/simpleCache.ts), TTL здесь 60 секунд. Выполненность aggregation cron и полнота таблиц отдельно не подтверждены: [OPERATIONS.md](../OPERATIONS.md).

| METHOD / path и source | Auth / input | Успех и ошибки | Side effects и ограничения |
| --- | --- | --- | --- |
| POST [`/admin/api/analytics/track`](../../apps/web/src/app/admin/api/analytics/track/route.ts) | Cookie user optional. JSON schema: nonempty event_type/source; optional nullable UUID biz_id/branch_id/booking_id, nonempty session_id, metadata object | `D({ok:true})`; 400 validation, 401 disallowed anonymous event, 500 `server` + details on insert failure | Anonymous разрешены home_view/business_page_view/booking_flow_start/booking_flow_step; logged-in user — любой event_type. Service insert с client_id текущего user; проверки принадлежности переданных entity IDs нет, metadata size/source enum не ограничены. Отсутствие limiter допускает засорение telemetry |
| GET [`/admin/api/analytics/overview`](../../apps/web/src/app/admin/api/analytics/overview/route.ts) | `CURRENT` через [read service](../../apps/web/src/lib/adminGlobalOverviewReadService.ts). Valid calendar startDate/endDate, defaults end=today/start=end−30; start≤end. bizId/branchIds запрещены schema | `D({scope:"all_businesses",summary,byDay})`, shape [aggregateGlobalOverview](../../apps/web/src/lib/adminGlobalOverviewService.ts); 400 input/role query, 500 aggregation | Один SQL JSON rollup по датам, максимум 366 дат; tenant rows клиенту не выдаются, REST max_rows не обрезает итог. Cache60s; это global overview, не текущий business |
| GET [`/admin/api/analytics/conversion-funnel`](../../apps/web/src/app/admin/api/analytics/conversion-funnel/route.ts) | `MANAGER`; optional UUID bizId, date form YYYY-MM-DD, source web/mobile. Defaults today/end−30 | `D({steps,overallConversion,period})`; step id,label,sessions,conversionFromPrev; 400 schema,403 foreign business,500 server, auth через helper | Читает analytics_events без pagination, unique nonempty session IDs отдельно по5 шагам. Не проверяет последовательность одной cohort; conversion может >100%. Cache60s; максимального range и start≤end проверки нет |
| GET [`/admin/api/analytics/load`](../../apps/web/src/app/admin/api/analytics/load/route.ts) | `MANAGER`; optional UUID bizId/branchId, date form; defaults today/end−30 | `D({bizId,branchId,period,points})`; point date,hour,bookingsCount,promoBookingsCount,staffCount,uniqueClientsCount; 400/403/500 как выше | Полный SQL JSON snapshot business_hourly_load с biz/branch scope; SQL проверяет филиал, календарь/порядок/max366 дат проверены. Cache60s; не запускает агрегацию и не гарантирует свежесть |
| GET [`/admin/api/analytics/promotions`](../../apps/web/src/app/admin/api/analytics/promotions/route.ts) | `MANAGER`; optional bizId/branchId UUID, dates form, groupBy type/day | `D({summary,byDay?,byType?,period})`; summary promoBookings,promoRevenue,totalRevenue; type rows promotionType,bookings,revenue,discountGiven; 400/403/500 | Один SQL snapshot live confirmed/paid bookings для summary/day/type, общий branch predicate и business-local [midnight,next midnight) с DST. Нет обращения к несуществующему daily.branch_id. Source error — non-success; календарь/start≤end/max366 дат, cache60s. Revenue — оценка цены/промо, не cash ledger |
| GET [`/admin/api/system-analytics/overview`](../../apps/web/src/app/admin/api/system-analytics/overview/route.ts) | `RPC`; optional startDate/endDate form, defaults today/end−30 | `D({summary,byDay})`; summary period,activeBusinesses,bookings.created/confirmed,revenue.total/avgCheck; day date,activeBusinesses,bookingsConfirmed,totalRevenue. 400 schema,401/403,500 server | Global SQL rollup daily_stats по датам и count distinct businesses, без REST cap. Max366 дат, cache60s. Wire shape отличается от analytics/overview |
| GET [`/admin/api/funnel-analytics`](../../apps/web/src/app/admin/api/funnel-analytics/route.ts) | `CURRENT`; optional UUID bizId, dates form, source public/quickdesk. Без dates выбирает весь доступный набор | `D({funnel,summary})`; rows step,stepName,uniqueSessions,totalEvents,conversionRate; summary totalViews,totalBookings,overallConversionRate,totalEvents. 400 schema,401/403,503 role-query error,500 DB | Читает другую таблицу funnel_events,6 шагов business_view→booking_success; без pagination/range cap. Null session_id считается элементом Set, stages не cohort-joined; exact totalEvents может превышать число возвращенных rows. Нельзя смешивать с analytics/conversion-funnel |

## Открытые границы справочника

Проверка исходников не подтверждает deployed RLS, наличие RPC, внешние ACL, SMTP/OTP delivery или rate capacity. Отмеченные `DB` не следует превращать в утверждение «endpoint защищен, потому что это admin URL». Неатомарные цепочки, success при проигнорированном `{error}`, sync params и неодинаковые envelopes сохранены как реальные ограничения. Статусы исправлений ведутся в [ENGINEERING_FINDINGS.md](../ENGINEERING_FINDINGS.md), факты WEB-приемки этим документом не изменены. Runtime с реальными внешними сервисами **NOT_RUN**, емкость **NOT_MEASURED**.

## Блокировка и удаление пользователей (ENG-31)

Проверено локально 11 ноября 2026; это контракт исходников, не утверждение о deployed-схеме. Источники: [миграция](../../supabase/migrations/20261111090000_user_lifecycle.sql), [HTTP service](../../apps/web/src/lib/userLifecycleHttpService.ts), [изолированный Auth/REST тест](../../scripts/test-user-lifecycle-isolated.cjs).

- Администратор проверяется по собственной cookie-сессии и повторно внутри SQL. Target-защита учитывает canonical global role, legacy super-admin и global user_roles. Себя блокировать/удалять нельзя. Владельца бизнеса можно блокировать; для удаления сначала нужна передача владения.
- `prepare_user_lifecycle` сохраняет одну текущую команду на target. Повтор того же действия и reason возвращает тот же command ID; завершённый повтор не вызывает Auth заново. Пока исход не подтверждён, другое действие получает 409. Другой действующий администратор может повторить ту же незавершённую команду после потери доступа первоначальным actor.
- Auth меняет identity через штатные admin update/delete. DB triggers проверяют command marker и актуальные права, синхронизируют suspension/receipt в той же транзакции. Поздний ban старой команды не может отменить более новое unblock. Ошибка Auth или потеря ответа разрешается чтением receipt; без подтверждения — 503, а не ложный успех.
- Block использует Auth ban 876000h и сохраняет user_suspensions до явного unblock. Удаляются все сессии и refresh tokens target; роли и staff-link остаются. Session-insert guard закрывает вход, гоняющийся с ban. Unblock снимает suspension/ban, но не возвращает старые сессии. Миграция также отзывает сессии прежних user_suspensions; session-insert guard запрещает новый вход до unblock. Уже потерянные старой реализацией роли автоматически не восстанавливаются.
- PostgREST pre-request отклоняет отозванный JWT и для security-definer RPC. Restrictive RLS добавлен к существующим RLS-таблицам public/storage; после lifecycle старый session_id не оживает при unblock. Это не останавливает запрос, уже авторизованный до commit, и не удаляет ранее скачанные данные. Для новых таблиц нужен тот же restrictive guard.
- Удаление сохраняет бизнесы, строки сотрудников и бронирований, включая исторические контактные поля. Прочие зависимости следуют действующим FK CASCADE/SET NULL; это не полное стирание персональных данных и не универсальная политика хранения всех пользовательских записей. Отдельный service-only due self-deletion сохраняет собственный контракт обезличивания и receipt; его blockers повторно проверяются в момент Auth DELETE.

Операционная последовательность и восстановление неизвестного исхода: [эксплуатация](../OPERATIONS.md#user-lifecycle-eng-31).
