# Supabase Setup

Этот проект связан с удалённым проектом Supabase: `beulnmftzbmtbdlgurht`

## Структура

- `config.toml` - конфигурация локального проекта Supabase
- `migrations/` - папка для миграций БД
- `seed.sql` - файл с тестовыми данными для локальной разработки

## Команды

### Работа с удалённым проектом

```bash
# Генерация TypeScript типов из схемы БД
npx supabase gen types typescript --project-id beulnmftzbmtbdlgurht > apps/web/src/types/supabase.ts

# Проверка статуса проекта
npx supabase projects list

# Просмотр информации о проекте
npx supabase projects api-keys --project-ref beulnmftzbmtbdlgurht
```

### Локальная разработка (требует Docker)

```bash
# Запуск локального Supabase
npx supabase start

# Остановка локального Supabase
npx supabase stop

# Сброс локальной БД и применение миграций
npx supabase db reset

# Создание новой миграции
npx supabase migration new <название_миграции>
```

### Миграции

```bash
# Скачать схему из удалённой БД (требует Docker)
npx supabase db pull

# Применить миграции к удалённой БД
npx supabase db push
```

## Генерация типов

TypeScript типы автоматически генерируются из схемы БД и хранятся в `apps/web/src/types/supabase.ts`.

Для обновления типов после изменений схемы:
```bash
npx supabase gen types typescript --project-id beulnmftzbmtbdlgurht > apps/web/src/types/supabase.ts
```

## Примечания

- Для локальной разработки требуется Docker Desktop
- Для работы с удалённым проектом Docker не обязателен
- Project ref: `beulnmftzbmtbdlgurht`
- URL проекта: `https://beulnmftzbmtbdlgurht.supabase.co`

