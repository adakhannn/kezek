# Security Headers - Конфигурация

## Обзор

В проекте настроены Security Headers для защиты от различных типов атак:
- XSS (Cross-Site Scripting)
- Clickjacking
- MIME Sniffing
- Man-in-the-Middle атаки
- И другие

## Настроенные Headers

### 1. X-DNS-Prefetch-Control
```
X-DNS-Prefetch-Control: on
```
**Назначение:** Разрешает браузеру предварительно разрешать DNS для внешних ссылок  
**Безопасность:** Нейтральный, улучшает производительность

### 2. Strict-Transport-Security (HSTS)
```
Strict-Transport-Security: max-age=63072000; includeSubDomains; preload
```
**Назначение:** Принудительное использование HTTPS  
**Параметры:**
- `max-age=63072000` - 2 года (в секундах)
- `includeSubDomains` - применяется ко всем поддоменам
- `preload` - включение в HSTS preload list браузеров

**Важно:** Работает только при доступе через HTTPS

### 3. X-Frame-Options
```
X-Frame-Options: SAMEORIGIN
```
**Назначение:** Защита от clickjacking  
**Значение:** `SAMEORIGIN` - разрешает встраивание только с того же домена

### 4. X-Content-Type-Options
```
X-Content-Type-Options: nosniff
```
**Назначение:** Предотвращает MIME type sniffing  
**Безопасность:** Защита от атак, использующих неправильное определение типа контента

### 5. X-XSS-Protection
```
X-XSS-Protection: 1; mode=block
```
**Назначение:** Включает встроенную защиту от XSS в старых браузерах  
**Примечание:** Современные браузеры используют CSP, но это полезно для обратной совместимости

### 6. Referrer-Policy
```
Referrer-Policy: origin-when-cross-origin
```
**Назначение:** Контролирует, какая информация отправляется в заголовке Referer  
**Значение:** Отправляет только origin при переходе на другой домен

### 7. Permissions-Policy
```
Permissions-Policy: camera=(), microphone=(), geolocation=()
```
**Назначение:** Отключает доступ к API камеры, микрофона и геолокации  
**Безопасность:** Защита от несанкционированного доступа к устройствам

### 8. Content-Security-Policy (CSP)
```
Content-Security-Policy: default-src 'self'; script-src 'self' 'unsafe-eval' 'unsafe-inline' https://api-maps.yandex.ru https://yandex.ru; ...
```
**Назначение:** Контролирует, какие ресурсы могут загружаться  
**Директивы:**
- `default-src 'self'` - по умолчанию только с того же домена
- `script-src` - разрешает скрипты с нашего домена, Yandex Maps API
- `style-src` - разрешает стили с нашего домена и Google Fonts
- `img-src` - разрешает изображения с любого HTTPS источника
- `connect-src` - разрешает подключения к Supabase, Facebook API, Telegram API
- `frame-src` - разрешает iframe с нашего домена и Google/Yandex
- `object-src 'none'` - запрещает объекты (Flash, плагины)
- `upgrade-insecure-requests` - автоматически обновляет HTTP на HTTPS

## Где настроено

### 1. next.config.ts
Security Headers настроены для всех статических и динамических routes через функцию `headers()`.

### 2. middleware.ts
Дополнительно добавляются в middleware для гарантии применения к динамическим routes.

## Проверка

### Онлайн инструменты
- https://securityheaders.com/ - проверка Security Headers
- https://observatory.mozilla.org/ - комплексная проверка безопасности

### Локальная проверка
```bash
# Проверка headers через curl
curl -I https://kezek.kg

# Или через браузер DevTools
# Network tab → выберите запрос → Headers → Response Headers
```

## Настройка CSP для новых интеграций

Если нужно добавить новый внешний сервис, обновите CSP в `next.config.ts`:

```typescript
{
    key: 'Content-Security-Policy',
    value: [
        "default-src 'self'",
        "script-src 'self' 'unsafe-eval' 'unsafe-inline' https://новый-сервис.com",
        "connect-src 'self' https://новый-сервис.com",
        // ...
    ].join('; ')
}
```

## Важные замечания

1. **CSP и 'unsafe-inline'**: 
   - Используется для Next.js и некоторых библиотек
   - В идеале нужно использовать nonces или hashes
   - Текущая конфигурация - компромисс между безопасностью и функциональностью

2. **HSTS Preload**:
   - Для включения в HSTS preload list нужно зарегистрироваться на https://hstspreload.org/
   - Требует, чтобы все поддомены работали через HTTPS

3. **Тестирование**:
   - После изменений CSP проверьте, что все функции работают
   - Особенно проверьте внешние интеграции (Yandex Maps, Supabase, etc.)

## Рекомендации для улучшения

1. **Использовать nonces для CSP**:
   ```typescript
   // Генерация nonce для каждого запроса
   const nonce = crypto.randomBytes(16).toString('base64');
   res.headers.set('Content-Security-Policy', `script-src 'nonce-${nonce}'`);
   ```

2. **Добавить Report-URI**:
   ```typescript
   "report-uri https://your-reporting-endpoint.com/csp-report"
   ```

3. **Использовать Subresource Integrity (SRI)** для внешних скриптов

4. **Добавить Expect-CT header** (устарело, но может быть полезно)

## Совместимость с Vercel

Все настроенные headers совместимы с Vercel и будут работать автоматически при деплое.

## Дополнительные ресурсы

- [MDN: Security Headers](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers#security)
- [OWASP: Secure Headers](https://owasp.org/www-project-secure-headers/)
- [Next.js: Headers](https://nextjs.org/docs/app/api-reference/next-config-js/headers)

