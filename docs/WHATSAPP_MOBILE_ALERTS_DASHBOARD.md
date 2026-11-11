# WhatsApp mobile auth: события, SQL и предлагаемые alerts

Статус: source-backed справочник и SQL-заготовки; сверка 2026-11-01. SQL execution, планы запросов, dashboard и alert delivery: `NOT_RUN`. Владелец: authentication / observability. Пороги ниже — **предлагаемая политика**, не измеренный SLO и не подтверждённая настройка production.

Источники: [metric writer](../apps/web/src/lib/whatsAppMobileMetricsService.ts), [start](../apps/web/src/lib/whatsAppMobileStartRouteService.ts), [verify](../apps/web/src/lib/whatsAppMobileVerifyRouteService.ts), [migration analytics_events](../supabase/migrations/20260227000000_create_analytics_events.sql). Контракт API — [CLIENT_AND_AUTH_FLOWS](api/CLIENT_AND_AUTH_FLOWS.md); настройки — [provider guide](MOBILE_WHATSAPP_PROVIDER_SETUP.md); эксплуатация — [Operations](OPERATIONS.md).

## Смысл событий и полнота данных

Writer вставляет строки в `public.analytics_events` с `source='mobile_auth_whatsapp'`. `session_id` содержит SHA-256 attempt ID, metadata — `attempt_hash`, `phone_hash` и переданные callsite поля. Это hash идентификатора попытки, не пользовательская сессия. Writer подавляет ошибки записи; в `NODE_ENV=test` запись выключена без специального override.

| event_type | Момент записи по текущему callsite |
| --- | --- |
| `mobile_whatsapp_login_started` | После создания OTP attempt, до отправки провайдеру; это не каждый запрос start |
| `mobile_whatsapp_otp_sent` | После успешного ответа исходящего sender; не подтверждение доставки/прочтения |
| `mobile_whatsapp_login_success` | После подготовки Auth session и создания exchange-code на сервере, **до получения session мобильным клиентом** |
| `mobile_whatsapp_login_failed` | Отдельные ошибки создания attempt, provider send, verify, подготовки credentials/session/exchange. Неверный OTP может дать несколько events для одной attempt |
| `mobile_whatsapp_login_expired` | При verify истёкшей attempt; это не фоновый подсчёт всех забытых попыток |

Метрики best-effort: часть early-return отказов и потери записи не входят в counts. Ошибка `attempt_insert` может не иметь attempt hash. Metadata success сейчас также содержит `userId`; её нельзя описывать как гарантированно анонимную. Не добавляйте raw phone, OTP, token или session в dashboards/логи.

Приведённые отношения `success/started`, `failed/started` — **отношения числа событий в окне**, не cohort conversion и не доля уникальных пользователей. Повторы и пересечение окон могут дать значения выше 100%. Для cohort funnel нужно отдельно связывать события по `session_id`, проверять полноту и определять допустимые повторы. `success` не закрывает OPEN риск [mobile-exchange](api/AUTH_AND_INTEGRATIONS.md).

## SQL: объём событий по часам UTC

Запросы рассчитаны на структуру связанной migration. Применённая схема, права читающей роли, объём таблицы и производительность неизвестны. Это SELECT-заготовки для отдельно разрешённой среды; перед регулярным исполнением нужны проверка и оценка плана. Пропущенные часы не заполняются нулями.

```sql
select
  date_trunc('hour', created_at at time zone 'UTC') as ts_hour_utc,
  count(*) filter (where event_type = 'mobile_whatsapp_login_started') as started,
  count(*) filter (where event_type = 'mobile_whatsapp_otp_sent') as otp_sent,
  count(*) filter (where event_type = 'mobile_whatsapp_login_success') as success,
  count(*) filter (where event_type = 'mobile_whatsapp_login_failed') as failed,
  count(*) filter (where event_type = 'mobile_whatsapp_login_expired') as expired
from public.analytics_events
where source = 'mobile_auth_whatsapp'
  and created_at >= now() - interval '72 hours'
  and created_at < now()
group by 1
order by ts_hour_utc desc;
```

## SQL: counts и отношения событий за 24 часа

При отсутствии starts отношения возвращают `NULL`, а не выдают нулевой traffic за хорошее/плохое качество. Dashboard должен показывать «нет достаточных данных» отдельно от здорового состояния.

```sql
with agg as (
  select
    count(*) filter (where event_type = 'mobile_whatsapp_login_started') as started,
    count(*) filter (where event_type = 'mobile_whatsapp_otp_sent') as otp_sent,
    count(*) filter (where event_type = 'mobile_whatsapp_login_success') as success,
    count(*) filter (where event_type = 'mobile_whatsapp_login_failed') as failed,
    count(*) filter (where event_type = 'mobile_whatsapp_login_expired') as expired
  from public.analytics_events
  where source = 'mobile_auth_whatsapp'
    and created_at >= now() - interval '24 hours'
    and created_at < now()
)
select
  started, otp_sent, success, failed, expired,
  round(100.0 * success / nullif(started, 0), 2) as success_to_started_pct,
  round(100.0 * failed / nullif(started, 0), 2) as failed_to_started_pct,
  round(100.0 * expired / nullif(started, 0), 2) as expired_to_started_pct,
  round(100.0 * otp_sent / nullif(started, 0), 2) as sent_to_started_pct
from agg;
```

## Кандидаты alert policy

Эти условия сохранены как исходные предложения для калибровки. Они не встроены в [healthCheckAlertsCronService](../apps/web/src/lib/healthCheckAlertsCronService.ts): там есть отдельные Telegram/Google проверки, но нет перечисленных WhatsApp условий. Сам SQL не создаёт scheduler, alert rule или канал доставки.

| Условие | Предлагаемый порог |
| --- | --- |
| Рост failed events | За 30 минут `failed/started > 35%` при `started >= 30` |
| Падение success events | За 60 минут `success/started < 40%`, baseline за предшествующие 24 часа `>= 60%`, текущих starts минимум 20 |
| Ошибки provider send | Минимум 10 failed events со `metadata.stage='provider_send'` за 15 минут |

Для baseline ниже дополнительно выводится его объём: прежнее условие не задаёт достаточного baseline sample size. Выбранный минимальный объём и thresholds нужно утвердить после проверки качества данных.

### Failed events за 30 минут

В старом варианте SELECT отсутствовал `FROM w`; здесь ссылка на CTE исправлена статически. Исполнение не проверялось.

```sql
with w as (
  select
    count(*) filter (where event_type = 'mobile_whatsapp_login_started') as started,
    count(*) filter (where event_type = 'mobile_whatsapp_login_failed') as failed
  from public.analytics_events
  where source = 'mobile_auth_whatsapp'
    and created_at >= now() - interval '30 minutes'
    and created_at < now()
)
select
  started,
  failed,
  failed::numeric / nullif(started, 0) as failed_to_started,
  coalesce(started >= 30 and failed::numeric / nullif(started, 0) > 0.35, false) as should_alert
from w;
```

### Success events: текущее окно и baseline

```sql
with current_w as (
  select
    count(*) filter (where event_type = 'mobile_whatsapp_login_started') as started,
    count(*) filter (where event_type = 'mobile_whatsapp_login_success') as success
  from public.analytics_events
  where source = 'mobile_auth_whatsapp'
    and created_at >= now() - interval '60 minutes'
    and created_at < now()
), baseline_w as (
  select
    count(*) filter (where event_type = 'mobile_whatsapp_login_started') as started,
    count(*) filter (where event_type = 'mobile_whatsapp_login_success') as success
  from public.analytics_events
  where source = 'mobile_auth_whatsapp'
    and created_at >= now() - interval '25 hours'
    and created_at < now() - interval '60 minutes'
)
select
  c.started as current_started,
  c.success as current_success,
  c.success::numeric / nullif(c.started, 0) as current_success_to_started,
  b.started as baseline_started,
  b.success as baseline_success,
  b.success::numeric / nullif(b.started, 0) as baseline_success_to_started,
  coalesce(
    c.started >= 20
    and c.success::numeric / nullif(c.started, 0) < 0.40
    and b.success::numeric / nullif(b.started, 0) >= 0.60,
    false
  ) as should_alert
from current_w c
cross join baseline_w b;
```

### Provider send failures за 15 минут

```sql
select
  count(*) as provider_send_failures_15m,
  count(*) >= 10 as should_alert
from public.analytics_events
where source = 'mobile_auth_whatsapp'
  and event_type = 'mobile_whatsapp_login_failed'
  and metadata->>'stage' = 'provider_send'
  and created_at >= now() - interval '15 minutes'
  and created_at < now();
```

### Распределение failed stages за 24 часа

```sql
select
  coalesce(metadata->>'stage', 'unknown') as stage,
  count(*) as failed_events
from public.analytics_events
where source = 'mobile_auth_whatsapp'
  and event_type = 'mobile_whatsapp_login_failed'
  and created_at >= now() - interval '24 hours'
  and created_at < now()
group by 1
order by failed_events desc;
```

## Использование в dashboard

Полезны panels counts по часам, отношения событий вместе со знаменателем, число provider failures и таблица stages. Дополнительно показывайте время последнего события, дату обновления панели и состояние сбора данных. `should_alert=false` не означает healthy при пустой/неполной телеметрии.

Окна 72/24 часа и thresholds выше не измерены на production traffic. Их пересматривают по согласованной выборке, объёму, сезонности и стоимости запросов; увеличение окна при малом трафике — вариант policy, а не обязательное изменение. Доступность alert rule, расписание, получатели и доставку проверяют отдельно по [Monitoring](../MONITORING_AND_ALERTS.md) и [Operations](OPERATIONS.md).
