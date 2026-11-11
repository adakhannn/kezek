# @core-domain

Статус: справочник пакета, сверено по exports и package.json 1 ноября 2026.

Пакет содержит общие бизнес-правила и порты. Принцип нового кода — независимость от Next.js/React/Expo и конкретного клиента БД. Это не утверждение, что все бизнес-правила Kezek уже перенесены сюда: SQL-функции и app services остаются существенной частью [архитектуры](../../PROJECT_DOCUMENTATION.md).

## Существующие модули

| Модуль | Назначение и источник |
| --- | --- |
| booking | [Use cases, модели и правила бронирования](src/booking/README.md); публичные exports в [index](src/booking/index.ts) |
| schedule | [Контекст расписания и фильтры](src/schedule/README.md); exports в [index](src/schedule/index.ts) |
| finance | [Расчёты долей, гарантий, позиций и смен](src/finance/index.ts) |
| ports | [Интерфейсы внешних зависимостей](src/ports/index.ts) |

Корневые exports: [src/index.ts](src/index.ts). Прежний отдельный promotions-каталог был пунктом плана; фактическую логику промо искать в booking и адаптерах приложения.

## Проверки и использование

[package.json](package.json) экспортирует TypeScript source. Из корня для разрешённого изменения:

```bash
pnpm -C packages/core-domain typecheck
pnpm -C packages/core-domain test
```

Изменение общего контракта требует проверок затронутых web/mobile потребителей по [CONTRIBUTING](../../CONTRIBUTING.md). Чистая функция и unit-test не подтверждают атомарность составной SQL/HTTP операции.
