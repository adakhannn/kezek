#!/bin/bash
# Скрипт для проверки использования console.log в проекте

echo "🔍 Поиск console.log/warn/error/info/debug в проекте..."
echo ""

# Исключаем файлы логирования и документацию
EXCLUDE_PATTERNS="log.ts|logSafe.ts|CONSOLE_LOG_MIGRATION.md|LOGGING_SECURITY.md|README.md|*.md"

# Подсчет вхождений
LOG_COUNT=$(grep -r "console\.log" apps/web/src --include="*.ts" --include="*.tsx" | grep -vE "$EXCLUDE_PATTERNS" | wc -l)
WARN_COUNT=$(grep -r "console\.warn" apps/web/src --include="*.ts" --include="*.tsx" | grep -vE "$EXCLUDE_PATTERNS" | wc -l)
ERROR_COUNT=$(grep -r "console\.error" apps/web/src --include="*.ts" --include="*.tsx" | grep -vE "$EXCLUDE_PATTERNS" | wc -l)
INFO_COUNT=$(grep -r "console\.info" apps/web/src --include="*.ts" --include="*.tsx" | grep -vE "$EXCLUDE_PATTERNS" | wc -l)
DEBUG_COUNT=$(grep -r "console\.debug" apps/web/src --include="*.ts" --include="*.tsx" | grep -vE "$EXCLUDE_PATTERNS" | wc -l)

TOTAL=$((LOG_COUNT + WARN_COUNT + ERROR_COUNT + INFO_COUNT + DEBUG_COUNT))

echo "📊 Статистика:"
echo "  console.log:  $LOG_COUNT"
echo "  console.warn: $WARN_COUNT"
echo "  console.error: $ERROR_COUNT"
echo "  console.info: $INFO_COUNT"
echo "  console.debug: $DEBUG_COUNT"
echo "  ─────────────────────"
echo "  Всего:        $TOTAL"
echo ""

if [ $TOTAL -eq 0 ]; then
    echo "✅ Отлично! Все console.* заменены на безопасное логирование!"
    exit 0
else
    echo "⚠️  Найдено $TOTAL использований console.*"
    echo ""
    echo "📝 Файлы с console.log:"
    grep -r "console\.log" apps/web/src --include="*.ts" --include="*.tsx" | grep -vE "$EXCLUDE_PATTERNS" | head -10
    echo ""
    echo "💡 Используйте logDebug, logWarn, logError из @/lib/log"
    exit 1
fi

