# WhatsApp Mobile Auth: Alerts and Dashboard

This document defines ready-to-use SQL queries and alert thresholds for Epic 9:
- failed rate spike
- approved rate drop
- provider error spike
- funnel dashboard (start -> sent -> success)

Data source:
- table: `analytics_events`
- filter: `source = 'mobile_auth_whatsapp'`
- event types:
  - `mobile_whatsapp_login_started`
  - `mobile_whatsapp_otp_sent`
  - `mobile_whatsapp_login_success`
  - `mobile_whatsapp_login_failed`
  - `mobile_whatsapp_login_expired`

---

## 1. Base Funnel Query (hourly)

```sql
with base as (
  select
    date_trunc('hour', created_at) as ts_hour,
    event_type,
    count(*) as cnt
  from analytics_events
  where source = 'mobile_auth_whatsapp'
    and created_at >= now() - interval '72 hours'
  group by 1, 2
)
select
  ts_hour,
  coalesce(sum(case when event_type = 'mobile_whatsapp_login_started' then cnt end), 0) as started,
  coalesce(sum(case when event_type = 'mobile_whatsapp_otp_sent' then cnt end), 0) as otp_sent,
  coalesce(sum(case when event_type = 'mobile_whatsapp_login_success' then cnt end), 0) as success,
  coalesce(sum(case when event_type = 'mobile_whatsapp_login_failed' then cnt end), 0) as failed,
  coalesce(sum(case when event_type = 'mobile_whatsapp_login_expired' then cnt end), 0) as expired
from base
group by ts_hour
order by ts_hour desc;
```

---

## 2. Conversion KPI Query (last 24h)

```sql
with agg as (
  select
    sum(case when event_type = 'mobile_whatsapp_login_started' then 1 else 0 end) as started,
    sum(case when event_type = 'mobile_whatsapp_otp_sent' then 1 else 0 end) as otp_sent,
    sum(case when event_type = 'mobile_whatsapp_login_success' then 1 else 0 end) as success,
    sum(case when event_type = 'mobile_whatsapp_login_failed' then 1 else 0 end) as failed,
    sum(case when event_type = 'mobile_whatsapp_login_expired' then 1 else 0 end) as expired
  from analytics_events
  where source = 'mobile_auth_whatsapp'
    and created_at >= now() - interval '24 hours'
)
select
  started,
  otp_sent,
  success,
  failed,
  expired,
  case when started > 0 then round((success::numeric / started) * 100, 2) else 0 end as success_rate_pct,
  case when started > 0 then round((failed::numeric / started) * 100, 2) else 0 end as failed_rate_pct,
  case when started > 0 then round((expired::numeric / started) * 100, 2) else 0 end as expired_rate_pct,
  case when started > 0 then round((otp_sent::numeric / started) * 100, 2) else 0 end as send_rate_pct
from agg;
```

---

## 3. Alert Queries

### A) Failed rate spike (critical)
Trigger if last 30m failed rate > 35% and at least 30 starts.

```sql
with w as (
  select
    sum(case when event_type = 'mobile_whatsapp_login_started' then 1 else 0 end) as started,
    sum(case when event_type = 'mobile_whatsapp_login_failed' then 1 else 0 end) as failed
  from analytics_events
  where source = 'mobile_auth_whatsapp'
    and created_at >= now() - interval '30 minutes'
)
select
  started,
  failed,
  case when started > 0 then (failed::numeric / started) else 0 end as failed_rate,
  (started >= 30 and (case when started > 0 then (failed::numeric / started) else 0 end) > 0.35) as should_alert;
```

### B) Approved rate drop (warning)
Trigger if:
- last 60m success rate < 40%
- and baseline (previous 24h excluding last 60m) >= 60%
- and volume in last 60m >= 20 starts.

```sql
with current_w as (
  select
    sum(case when event_type = 'mobile_whatsapp_login_started' then 1 else 0 end) as started,
    sum(case when event_type = 'mobile_whatsapp_login_success' then 1 else 0 end) as success
  from analytics_events
  where source = 'mobile_auth_whatsapp'
    and created_at >= now() - interval '60 minutes'
),
baseline_w as (
  select
    sum(case when event_type = 'mobile_whatsapp_login_started' then 1 else 0 end) as started,
    sum(case when event_type = 'mobile_whatsapp_login_success' then 1 else 0 end) as success
  from analytics_events
  where source = 'mobile_auth_whatsapp'
    and created_at >= now() - interval '25 hours'
    and created_at < now() - interval '60 minutes'
)
select
  c.started as current_started,
  c.success as current_success,
  case when c.started > 0 then c.success::numeric / c.started else 0 end as current_success_rate,
  b.started as baseline_started,
  b.success as baseline_success,
  case when b.started > 0 then b.success::numeric / b.started else 0 end as baseline_success_rate,
  (
    c.started >= 20
    and (case when c.started > 0 then c.success::numeric / c.started else 0 end) < 0.40
    and (case when b.started > 0 then b.success::numeric / b.started else 0 end) >= 0.60
  ) as should_alert
from current_w c
cross join baseline_w b;
```

### C) Provider error spike (critical)
Uses `mobile_whatsapp_login_failed` where metadata.stage = `provider_send`.
Trigger if provider send failures >= 10 in 15m.

```sql
select
  count(*) as provider_send_failures_15m,
  (count(*) >= 10) as should_alert
from analytics_events
where source = 'mobile_auth_whatsapp'
  and event_type = 'mobile_whatsapp_login_failed'
  and coalesce(metadata->>'stage', '') = 'provider_send'
  and created_at >= now() - interval '15 minutes';
```

---

## 4. Dashboard Panels (recommended)

1. `Started / Sent / Success / Failed / Expired` (time-series, 72h)
- Query: section 1.

2. `Success Rate %` (single stat, 24h)
- Query: section 2 (`success_rate_pct`).

3. `Failed Rate %` (single stat, 24h)
- Query: section 2 (`failed_rate_pct`).

4. `Send Rate %` (single stat, 24h)
- Query: section 2 (`send_rate_pct`).

5. `Provider Failure Count (15m)` (single stat + threshold)
- Query: section 3.C.

6. `Top fail stages` (table, 24h)

```sql
select
  coalesce(metadata->>'stage', 'unknown') as stage,
  count(*) as failed_count
from analytics_events
where source = 'mobile_auth_whatsapp'
  and event_type = 'mobile_whatsapp_login_failed'
  and created_at >= now() - interval '24 hours'
group by 1
order by failed_count desc;
```

---

## 5. Operational Notes

- Keep phone and OTP masked in logs; use only hashes in metrics metadata.
- Review thresholds after first 7 days of production traffic.
- If traffic is low, increase windows (`30m -> 2h`) to reduce noisy alerts.

