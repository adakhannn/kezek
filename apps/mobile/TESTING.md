# Проверки мобильного приложения

Статус: действующий справочник, сверка конфигурации по исходникам 1 ноября 2026. Результаты выполнения этой редакцией не получены.

Общие правила и границы CI — [TESTING_GUIDE](../../TESTING_GUIDE.md), необходимые проверки изменения — [CONTRIBUTING](../../CONTRIBUTING.md). Ниже только особенности mobile, без второй политики выпуска.

## Команды

Из корня репозитория после подготовки зависимостей:

| Команда | Что запускает |
| --- | --- |
| `pnpm -C apps/mobile typecheck` | `tsc --noEmit` |
| `pnpm -C apps/mobile test:runInBand` | Jest последовательно, watch выключен |
| `pnpm -C apps/mobile test:watch` | Jest watch для отдельной dev-сессии |
| `pnpm -C apps/mobile test:coverage` | Jest с отчётом покрытия |

Источник команд: [package.json](package.json). Документационные изменения этих запусков не требуют.

## Конфигурация и источники тестов

[Jest config](jest.config.js) использует preset `react-native`, среду `node`, [jest.setup.js](jest.setup.js) и собственные правила transform/moduleNameMapper. Наличие зависимости jest-expo не означает, что текущий preset равен jest-expo.

Тесты: [src/__tests__](src/__tests__), в том числе [screens](src/__tests__/screens) и [navigation](src/__tests__/navigation). Источник точного состава — файлы тестов и testMatch, а не старый фиксированный список экранов.

Coverage собирается для screens, components и navigation с исключением деклараций/story-файлов. В config нет coverageThreshold; процент не является установленным проходным порогом. Моки и render-тесты не доказывают работоспособность Supabase, deep links или устройства.

CI `mobile_tests` запускает `test:runInBand`; mobile typecheck отдельным job не указан. Конфигурация workflow не доказывает обязательность branch checks или готовность релиза.

## Осмысленная проверка изменения

Для изменённого экрана проверять наблюдаемое поведение: загрузку/ошибку, доступное действие, параметры вызова и реакцию на отказ. Ожидание только наличия одного элемента не заменяет проверку сценария.

Для интеграций установить изоляцию network и явный API URL. [apiUrl.ts](src/lib/apiUrl.ts) содержит fallback-ветку для test; один NODE_ENV=test не является гарантией отсутствия обращений к production.

Записать команду, ревизию, среду, exit code, PASS/FAIL/SKIP и непроверенные зависимости. Устройство и UI проверяются отдельно по [сценариям smoke](SMOKE_TESTS.md). Автоматическая документационная проверка не запускает Jest или приложение.
