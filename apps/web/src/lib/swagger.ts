import swaggerJsdoc from 'swagger-jsdoc';

const options: swaggerJsdoc.Options = {
    definition: {
        openapi: '3.0.0',
        info: {
            title: 'Kezek API',
            version: '1.0.0', // соответствует текущей версии публичного API v1
            description: `API документация для платформы Kezek - система управления бронированиями для салонов красоты

## Формат ответов

Все API endpoints возвращают ответы в едином формате:

### Успешный ответ
\`\`\`json
{
  "ok": true,
  "data": { ... }
}
\`\`\`

### Ответ с ошибкой
\`\`\`json
{
  "ok": false,
  "error": "error_type",
  "message": "Человеко-читаемое сообщение",
  "details": { ... }
}
\`\`\`

## Типы ошибок

- **auth** (401) - Ошибка авторизации
- **forbidden** (403) - Доступ запрещен
- **not_found** (404) - Ресурс не найден
- **validation** (400) - Ошибка валидации
- **conflict** (409) - Конфликт данных
- **rate_limit** (429) - Превышен лимит запросов
- **internal** (500) - Внутренняя ошибка сервера
- **service_unavailable** (503) - Сервис недоступен

Подробнее см. [API_ERROR_FORMATS.md](../lib/API_ERROR_FORMATS.md)`,
            contact: {
                name: 'Kezek Support',
                email: 'support@kezek.kg',
            },
        },
        'x-api-version': 'v1',
        servers: [
            {
                url: process.env.NEXT_PUBLIC_SITE_ORIGIN || 'http://localhost:3000',
                description: 'Production server',
            },
            {
                url: 'http://localhost:3000',
                description: 'Development server',
            },
        ],
        components: {
            securitySchemes: {
                bearerAuth: {
                    type: 'http',
                    scheme: 'bearer',
                    bearerFormat: 'JWT',
                    description: 'Bearer token для мобильного приложения',
                },
                cookieAuth: {
                    type: 'apiKey',
                    in: 'cookie',
                    name: 'sb-access-token',
                    description: 'Cookie для веб-версии',
                },
            },
            schemas: {
                Error: {
                    type: 'object',
                    required: ['ok', 'error'],
                    properties: {
                        ok: {
                            type: 'boolean',
                            example: false,
                            description: 'Всегда false для ответов с ошибкой',
                        },
                        error: {
                            type: 'string',
                            enum: ['auth', 'forbidden', 'not_found', 'validation', 'conflict', 'rate_limit', 'internal', 'service_unavailable'],
                            example: 'validation',
                            description: 'Тип ошибки. Возможные значения: auth (401), forbidden (403), not_found (404), validation (400), conflict (409), rate_limit (429), internal (500), service_unavailable (503)',
                        },
                        message: {
                            type: 'string',
                            example: 'Человеко-читаемое сообщение об ошибке',
                            description: 'Опциональное сообщение для пользователя',
                        },
                        details: {
                            type: 'object',
                            description: 'Дополнительные детали ошибки (только в dev режиме)',
                            additionalProperties: true,
                        },
                    },
                },
                SuccessResponse: {
                    type: 'object',
                    required: ['ok'],
                    properties: {
                        ok: {
                            type: 'boolean',
                            example: true,
                            description: 'Всегда true для успешных ответов',
                        },
                        data: {
                            description: 'Данные ответа (опционально)',
                            additionalProperties: true,
                        },
                    },
                },
                Booking: {
                    type: 'object',
                    properties: {
                        id: {
                            type: 'string',
                            format: 'uuid',
                        },
                        status: {
                            type: 'string',
                            enum: ['hold', 'confirmed', 'paid', 'cancelled'],
                        },
                        total_amount: {
                            type: 'number',
                            example: 1000,
                        },
                        promotion_applied: {
                            type: 'object',
                            nullable: true,
                        },
                    },
                },
                StaffShift: {
                    type: 'object',
                    properties: {
                        id: {
                            type: 'string',
                            format: 'uuid',
                        },
                        date: {
                            type: 'string',
                            format: 'date',
                        },
                        status: {
                            type: 'string',
                            enum: ['open', 'closed'],
                        },
                        total_amount: {
                            type: 'number',
                        },
                        master_share: {
                            type: 'number',
                        },
                        salon_share: {
                            type: 'number',
                        },
                        hours_worked: {
                            type: 'number',
                        },
                    },
                },
            },
        },
        tags: [
            {
                name: 'Authentication',
                description: 'Эндпоинты для аутентификации',
            },
            {
                name: 'Bookings',
                description: 'Управление бронированиями',
            },
            {
                name: 'Staff',
                description: 'Управление сотрудниками',
            },
            {
                name: 'Shifts',
                description: 'Управление сменами сотрудников',
            },
            {
                name: 'Dashboard',
                description: 'Дашборд для менеджеров и владельцев',
            },
            {
                name: 'Admin',
                description: 'Административные функции',
            },
            {
                name: 'Cron',
                description: 'Cron jobs для автоматизации',
            },
            {
                name: 'Profile',
                description: 'Управление профилем пользователя',
            },
        ],
    },
    apis: [
        './src/app/api/**/route.ts', // Путь к API routes
    ],
};

export const swaggerSpec = swaggerJsdoc(options);

