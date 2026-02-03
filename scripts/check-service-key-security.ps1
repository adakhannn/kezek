# Скрипт для проверки, что SUPABASE_SERVICE_ROLE_KEY не используется в клиентском коде (PowerShell)

Write-Host "🔍 Проверка безопасности Service Role Key..." -ForegroundColor Cyan

$errors = 0

# Проверка 1: Service key не должен использоваться в client components
Write-Host ""
Write-Host "Проверка 1: Поиск использования service key в client components..." -ForegroundColor Yellow

$clientFiles = Get-ChildItem -Path "apps/web/src" -Recurse -Include "*.tsx", "*.ts" | 
    Where-Object { (Get-Content $_.FullName -Raw) -match "'use client'|`"use client`"" } |
    Select-Object -ExpandProperty FullName

foreach ($file in $clientFiles) {
    $content = Get-Content $file -Raw
    if ($content -match "getSupabaseServiceRoleKey|SUPABASE_SERVICE_ROLE_KEY") {
        Write-Host "❌ ОШИБКА: Service key используется в client component: $file" -ForegroundColor Red
        $errors++
    }
}

# Проверка 2: Прямое использование process.env.SUPABASE_SERVICE_ROLE_KEY должно быть заменено
Write-Host ""
Write-Host "Проверка 2: Поиск прямого использования process.env.SUPABASE_SERVICE_ROLE_KEY..." -ForegroundColor Yellow

$directUsage = Get-ChildItem -Path "apps/web/src" -Recurse -Include "*.tsx", "*.ts" |
    Select-String -Pattern "process\.env\.SUPABASE_SERVICE_ROLE_KEY" |
    Where-Object { $_.Path -notmatch "env\.ts|SECURITY\.md" }

if ($directUsage) {
    Write-Host "⚠️  Предупреждение: Найдено $($directUsage.Count) использований прямого доступа к process.env.SUPABASE_SERVICE_ROLE_KEY" -ForegroundColor Yellow
    Write-Host "   Рекомендуется использовать getSupabaseServiceRoleKey() из @/lib/env" -ForegroundColor Yellow
    $directUsage | ForEach-Object { Write-Host "   $($_.Path):$($_.LineNumber)" -ForegroundColor Gray }
}

# Проверка 3: Убедиться, что защита в env.ts работает
Write-Host ""
Write-Host "Проверка 3: Проверка наличия защиты в env.ts..." -ForegroundColor Yellow

$envFile = "apps/web/src/lib/env.ts"
if (Test-Path $envFile) {
    $envContent = Get-Content $envFile -Raw
    if ($envContent -notmatch "typeof window !== 'undefined'") {
        Write-Host "❌ ОШИБКА: Защита от клиентского использования не найдена в env.ts" -ForegroundColor Red
        $errors++
    } else {
        Write-Host "✅ Защита от клиентского использования найдена" -ForegroundColor Green
    }
} else {
    Write-Host "❌ ОШИБКА: Файл env.ts не найден" -ForegroundColor Red
    $errors++
}

# Итоги
Write-Host ""
if ($errors -eq 0) {
    Write-Host "✅ Все проверки пройдены!" -ForegroundColor Green
    exit 0
} else {
    Write-Host "❌ Найдено $errors критических ошибок безопасности!" -ForegroundColor Red
    exit 1
}

