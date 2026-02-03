#!/bin/bash

# Скрипт для проверки, что SUPABASE_SERVICE_ROLE_KEY не используется в клиентском коде

echo "🔍 Проверка безопасности Service Role Key..."

ERRORS=0

# Проверка 1: Service key не должен использоваться в client components
echo ""
echo "Проверка 1: Поиск использования service key в client components..."

CLIENT_FILES=$(grep -r "'use client'" apps/web/src --include="*.tsx" --include="*.ts" -l)

for file in $CLIENT_FILES; do
    if grep -q "getSupabaseServiceRoleKey\|SUPABASE_SERVICE_ROLE_KEY" "$file"; then
        echo "❌ ОШИБКА: Service key используется в client component: $file"
        ERRORS=$((ERRORS + 1))
    fi
done

# Проверка 2: Прямое использование process.env.SUPABASE_SERVICE_ROLE_KEY должно быть заменено
echo ""
echo "Проверка 2: Поиск прямого использования process.env.SUPABASE_SERVICE_ROLE_KEY..."

DIRECT_USAGE=$(grep -r "process\.env\.SUPABASE_SERVICE_ROLE_KEY" apps/web/src --include="*.tsx" --include="*.ts" | grep -v "env.ts" | grep -v "SECURITY.md" | wc -l)

if [ "$DIRECT_USAGE" -gt 0 ]; then
    echo "⚠️  Предупреждение: Найдено $DIRECT_USAGE использований прямого доступа к process.env.SUPABASE_SERVICE_ROLE_KEY"
    echo "   Рекомендуется использовать getSupabaseServiceRoleKey() из @/lib/env"
    grep -r "process\.env\.SUPABASE_SERVICE_ROLE_KEY" apps/web/src --include="*.tsx" --include="*.ts" | grep -v "env.ts" | grep -v "SECURITY.md"
fi

# Проверка 3: Убедиться, что защита в env.ts работает
echo ""
echo "Проверка 3: Проверка наличия защиты в env.ts..."

if ! grep -q "typeof window !== 'undefined'" apps/web/src/lib/env.ts; then
    echo "❌ ОШИБКА: Защита от клиентского использования не найдена в env.ts"
    ERRORS=$((ERRORS + 1))
else
    echo "✅ Защита от клиентского использования найдена"
fi

# Итоги
echo ""
if [ $ERRORS -eq 0 ]; then
    echo "✅ Все проверки пройдены!"
    exit 0
else
    echo "❌ Найдено $ERRORS критических ошибок безопасности!"
    exit 1
fi

