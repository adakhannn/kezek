param(
    [string]$ConfigPath = (Join-Path $PSScriptRoot '..\apps\web\telegram-test.env.local')
)

$ErrorActionPreference = 'Stop'

if (-not (Test-Path -LiteralPath $ConfigPath)) {
    throw 'Не найден локальный конфиг тестового Telegram-бота.'
}

$settings = @{}
foreach ($line in Get-Content -LiteralPath $ConfigPath) {
    $trimmed = $line.Trim()
    if (-not $trimmed -or $trimmed.StartsWith('#') -or -not $trimmed.Contains('=')) { continue }
    $name, $value = $trimmed.Split('=', 2)
    $settings[$name.Trim()] = $value.Trim()
}

$token = $settings.TELEGRAM_BOT_TOKEN
$username = [string]$settings.NEXT_PUBLIC_TELEGRAM_BOT_USERNAME
$username = $username.TrimStart('@')
if ($token -notmatch '^[0-9]+:[A-Za-z0-9_-]+$' -or $username -notmatch '^[A-Za-z0-9_]+$') {
    throw 'Токен или username тестового Telegram-бота заполнены неверно.'
}

$env:TELEGRAM_BOT_TOKEN = $token
$env:NEXT_PUBLIC_TELEGRAM_BOT_USERNAME = $username
$env:TELEGRAM_WEBHOOK_SECRET = $settings.TELEGRAM_WEBHOOK_SECRET
$env:NEXT_PUBLIC_TELEGRAM_BOT_LINK_ENABLED = $settings.NEXT_PUBLIC_TELEGRAM_BOT_LINK_ENABLED
$env:NEXT_PUBLIC_TELEGRAM_BOT_LOGIN_ENABLED = $settings.NEXT_PUBLIC_TELEGRAM_BOT_LOGIN_ENABLED
if ($settings.PUBLIC_TUNNEL_URL) {
    $tunnelUri = [Uri]$settings.PUBLIC_TUNNEL_URL
    if ($tunnelUri.Scheme -ne 'https' -or $tunnelUri.AbsolutePath -ne '/' -or $tunnelUri.Query -or $tunnelUri.Fragment) {
        throw 'PUBLIC_TUNNEL_URL должен содержать только HTTPS-домен туннеля.'
    }
    $env:LOCAL_AUTH_PUBLIC_ORIGIN = $tunnelUri.GetLeftPart([System.UriPartial]::Authority)
}
if ($settings.YANDEX_OAUTH_CLIENT_ID -or $settings.YANDEX_OAUTH_CLIENT_SECRET) {
    if ($settings.YANDEX_OAUTH_CLIENT_ID -notmatch '^[a-f0-9]{32}$' -or
        $settings.YANDEX_OAUTH_CLIENT_SECRET -notmatch '^[a-f0-9]{32}$') {
        throw 'Client ID и Client secret тестового Яндекс-приложения должны быть заполнены вместе.'
    }
    $env:YANDEX_OAUTH_CLIENT_ID = $settings.YANDEX_OAUTH_CLIENT_ID
    $env:YANDEX_OAUTH_CLIENT_SECRET = $settings.YANDEX_OAUTH_CLIENT_SECRET
    $env:NEXT_PUBLIC_YANDEX_CLIENT_ID = $settings.YANDEX_OAUTH_CLIENT_ID
}

$webPath = Join-Path $PSScriptRoot '..\apps\web'
$nextCommand = Join-Path $webPath 'node_modules\.bin\next.cmd'
if (-not (Test-Path -LiteralPath $nextCommand)) {
    throw 'Не найдены локальные зависимости Kezek. Сначала установите зависимости проекта.'
}

Set-Location -LiteralPath $webPath
& $nextCommand dev --turbopack
exit $LASTEXITCODE
