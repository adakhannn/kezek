#!/bin/bash
# Скрипт для запуска критичных SQL-тестов
# Использование:
#   ./scripts/run-tests.sh                    # локально (требует supabase CLI)
#   SUPABASE_DB_URL=... ./scripts/run-tests.sh # с явным URL БД

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
TEST_FILE="$PROJECT_ROOT/supabase/tests_critical_scenarios.sql"

echo "🧪 Запуск критичных SQL-тестов..."

if [ -n "$SUPABASE_DB_URL" ]; then
    # Используем явный URL БД (для CI)
    echo "📡 Подключение к БД через SUPABASE_DB_URL..."
    psql "$SUPABASE_DB_URL" -f "$TEST_FILE"
elif command -v supabase &> /dev/null; then
    # Используем Supabase CLI (для локального запуска)
    echo "📡 Подключение к БД через Supabase CLI..."
    cd "$PROJECT_ROOT"
    supabase db execute --file "$TEST_FILE"
else
    echo "❌ Ошибка: требуется либо SUPABASE_DB_URL, либо установленный Supabase CLI"
    echo ""
    echo "Установите Supabase CLI:"
    echo "  npm install -g supabase"
    echo ""
    echo "Или укажите SUPABASE_DB_URL:"
    echo "  SUPABASE_DB_URL=postgresql://... ./scripts/run-tests.sh"
    exit 1
fi

echo "✅ Все тесты пройдены успешно!"

