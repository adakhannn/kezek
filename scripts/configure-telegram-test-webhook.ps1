param(
    [string]$ConfigPath = (Join-Path $PSScriptRoot '..\apps\web\telegram-test.env.local')
)

$ErrorActionPreference = 'Stop'

if (-not (Test-Path -LiteralPath $ConfigPath)) {
    throw "Не найден локальный конфиг: $ConfigPath. Скопируйте apps/web/telegram-test.env.example как telegram-test.env.local."
}

$settings = @{}
foreach ($line in Get-Content -LiteralPath $ConfigPath) {
    $trimmed = $line.Trim()
    if (-not $trimmed -or $trimmed.StartsWith('#') -or -not $trimmed.Contains('=')) { continue }
    $name, $value = $trimmed.Split('=', 2)
    $settings[$name.Trim()] = $value.Trim()
}

foreach ($required in @('TELEGRAM_BOT_TOKEN', 'NEXT_PUBLIC_TELEGRAM_BOT_USERNAME', 'TELEGRAM_WEBHOOK_SECRET', 'PUBLIC_TUNNEL_URL')) {
    if (-not $settings[$required]) { throw "В telegram-test.env.local не задано значение $required." }
}

$tunnelUri = [Uri]$settings.PUBLIC_TUNNEL_URL
if ($tunnelUri.Scheme -ne 'https' -or -not $tunnelUri.Host) {
    throw 'PUBLIC_TUNNEL_URL должен быть публичным HTTPS-адресом туннеля.'
}

$webhookUrl = "$($tunnelUri.GetLeftPart([System.UriPartial]::Authority))/api/webhooks/telegram"
$response = Invoke-RestMethod -Method Post `
    -Uri "https://api.telegram.org/bot$($settings.TELEGRAM_BOT_TOKEN)/setWebhook" `
    -Body @{ url = $webhookUrl; secret_token = $settings.TELEGRAM_WEBHOOK_SECRET }

if (-not $response.ok) { throw 'Telegram не подтвердил настройку webhook тестового бота.' }

Write-Host 'Webhook тестового Telegram-бота настроен.'
