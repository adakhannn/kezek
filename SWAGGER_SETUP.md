# Swagger/OpenAPI Documentation Setup

## Обзор

В проекте настроена документация API с использованием Swagger/OpenAPI. Документация доступна по адресу `/api-docs` и генерируется автоматически из JSDoc комментариев в API routes.

## Использование

### Просмотр документации

1. Запустите dev сервер: `pnpm dev`
2. Откройте в браузере: `http://localhost:3000/api-docs`
3. Вы увидите интерактивную Swagger UI документацию

### JSON спецификация

OpenAPI спецификация доступна в формате JSON по адресу:
- `http://localhost:3000/api/swagger.json`

## Добавление документации к новым endpoints

Чтобы добавить документацию к новому API endpoint, добавьте JSDoc комментарии с аннотациями `@swagger`:

```typescript
/**
 * @swagger
 * /api/example:
 *   post:
 *     summary: Краткое описание endpoint
 *     tags: [Bookings]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *     responses:
 *       '200':
 *         description: Успешный ответ
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 ok:
 *                   type: boolean
 */
export async function POST(req: Request) {
    // ...
}
```

## Доступные теги

- `Authentication` - Эндпоинты для аутентификации
- `Bookings` - Управление бронированиями
- `Staff` - Управление сотрудниками
- `Shifts` - Управление сменами сотрудников
- `Dashboard` - Дашборд для менеджеров и владельцев
- `Admin` - Административные функции
- `Cron` - Cron jobs для автоматизации
- `Profile` - Управление профилем пользователя

## Схемы

В конфигурации Swagger определены общие схемы:
- `Error` - Формат ошибок
- `Booking` - Бронирование
- `StaffShift` - Смена сотрудника

Используйте их через `$ref`:
```yaml
schema:
  $ref: '#/components/schemas/Error'
```

## Безопасность

Документация поддерживает два типа авторизации:
- `bearerAuth` - Bearer token (для мобильного приложения)
- `cookieAuth` - Cookie (для веб-версии)

## Конфигурация

Конфигурация находится в `apps/web/src/lib/swagger.ts`. Здесь можно:
- Изменить информацию о API
- Добавить новые серверы
- Добавить новые схемы
- Добавить новые теги

## Примеры

Примеры документации уже добавлены к следующим endpoints:
- `/api/quick-hold` - Создание бронирования
- `/api/staff/shift/open` - Открытие смены
- `/api/bookings/[id]/mark-attendance` - Отметка посещения

## Полезные ссылки

- [OpenAPI Specification](https://swagger.io/specification/)
- [Swagger JSDoc](https://github.com/Surnet/swagger-jsdoc)
- [Swagger UI React](https://github.com/swagger-api/swagger-ui)

