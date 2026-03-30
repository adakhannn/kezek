# Project Improvement Progress 2026-03-30

## Phase 6.1 Status

`Phase 6.1` is effectively complete. The `apps/web/src/app/api` layer has been normalized to the thin-route pattern:

- route = transport/error boundary/rate limit only
- HTTP-level request parsing, auth/context wiring, and response mapping live in `*HttpService.ts`
- business orchestration remains in lower route/service/domain layers

## Newly Completed HTTP-Layer Migrations

The latest pass added dedicated HTTP services for:

- `dataRetentionCron`
- `closeShiftsCron`
- `telegramLogin`
- `usersSearch`
- `integrationsStatus`
- `whatsAppTest`
- `promotionsDebug`
- `yandexAuthCallback`
- `financeAllDashboard`
- `staffShiftToday`

New test coverage was added for:

- `dataRetentionCronHttpService.test.ts`
- `closeShiftsCronHttpService.test.ts`
- `telegramLoginHttpService.test.ts`
- `usersSearchHttpService.test.ts`
- `integrationsStatusHttpService.test.ts`
- `whatsAppTestHttpService.test.ts`
- `promotionsDebugHttpService.test.ts`
- `yandexAuthCallbackHttpService.test.ts`
- `financeAllDashboardHttpService.test.ts`
- `staffShiftTodayHttpService.test.ts`

## Current Baseline

Confirmed with:

```bash
pnpm -C apps/web test:coverage -- --runInBand --forceExit
```

Result:

- `288/288` suites passing
- `1061/1061` tests passing
- `94.64% statements`
- `87.54% branches`
- `98.68% functions`
- `96.18% lines`

## Remaining Route Tail

A repeated route scan shows no meaningful heavy handlers left in `apps/web/src/app/api` aside from:

- `src/app/api/swagger.json/route.ts`

This remaining route is infrastructure-only and does not contain business orchestration, so it does not need a dedicated HTTP-layer extraction.

`src/app/api/staff/finance/route.ts` still appears in simple text scans only because of comments, not because it still contains inline orchestration.

## Recommended Next Step

The next logical move is outside the mechanical route-thinning wave:

1. clean up documentation consistency and stale progress markers
2. optionally normalize files with broken legacy encoding/comments
3. choose the next architecture phase after `6.1`
