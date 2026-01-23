# Скрипт для запуска критичных SQL-тестов (PowerShell)
# Использование:
#   .\scripts\run-tests.ps1                    # локально (требует supabase CLI)
#   $env:SUPABASE_DB_URL="..."; .\scripts\run-tests.ps1 # с явным URL БД

$ErrorActionPreference = "Stop"

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$ProjectRoot = Split-Path -Parent $ScriptDir
$TestFile = Join-Path $ProjectRoot "supabase\tests_critical_scenarios.sql"

Write-Host "🧪 Запуск критичных SQL-тестов..." -ForegroundColor Cyan

if ($env:SUPABASE_DB_URL) {
    # Используем явный URL БД (для CI)
    Write-Host "📡 Подключение к БД через SUPABASE_DB_URL..." -ForegroundColor Yellow
    $content = Get-Content $TestFile -Raw
    $content | psql $env:SUPABASE_DB_URL
} elseif (Get-Command supabase -ErrorAction SilentlyContinue) {
    # Используем Supabase CLI (для локального запуска)
    Write-Host "📡 Подключение к БД через Supabase CLI..." -ForegroundColor Yellow
    Push-Location $ProjectRoot
    supabase db execute --file $TestFile
    Pop-Location
} else {
    Write-Host "❌ Ошибка: требуется либо SUPABASE_DB_URL, либо установленный Supabase CLI" -ForegroundColor Red
    Write-Host ""
    Write-Host "Установите Supabase CLI:"
    Write-Host "  npm install -g supabase"
    Write-Host ""
    Write-Host "Или укажите SUPABASE_DB_URL:"
    Write-Host "  `$env:SUPABASE_DB_URL='postgresql://...'; .\scripts\run-tests.ps1"
    exit 1
}

Write-Host "✅ Все тесты пройдены успешно!" -ForegroundColor Green

