import swaggerJsdoc from 'swagger-jsdoc';

const options: swaggerJsdoc.Options = {
    definition: {
        openapi: '3.0.0',
        info: {
            title: 'Kezek API',
            version: '1.0.0',
            description: 'API документация для платформы Kezek - система управления бронированиями для салонов красоты',
            contact: {
                name: 'Kezek Support',
                email: 'support@kezek.kg',
            },
        },
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
                    properties: {
                        ok: {
                            type: 'boolean',
                            example: false,
                        },
                        error: {
                            type: 'string',
                            example: 'validation',
                        },
                        message: {
                            type: 'string',
                            example: 'Human readable error message',
                        },
                        details: {
                            type: 'object',
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

