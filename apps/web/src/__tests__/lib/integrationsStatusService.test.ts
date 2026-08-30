import {
    checkTelegramIntegration,
    checkWhatsAppIntegration,
    getIntegrationsStatus,
} from '@/lib/integrationsStatusService';

describe('integrationsStatusService', () => {
    test('returns not configured WhatsApp status when env is missing', async () => {
        const result = await checkWhatsAppIntegration({
            env: {},
            fetcher: jest.fn() as never,
        });

        expect(result).toEqual({
            configured: false,
            ok: false,
            message: 'WHATSAPP_ACCESS_TOKEN или WHATSAPP_PHONE_NUMBER_ID не заданы',
        });
    });

    test('returns validation-style WhatsApp status for invalid phone id', async () => {
        const result = await checkWhatsAppIntegration({
            env: {
                WHATSAPP_ACCESS_TOKEN: 'token',
                WHATSAPP_PHONE_NUMBER_ID: 'abc',
            },
            fetcher: jest.fn() as never,
        });

        expect(result).toEqual({
            configured: true,
            ok: false,
            message: 'WHATSAPP_PHONE_NUMBER_ID должен быть числом (см. Meta Developers)',
        });
    });

    test('returns healthy statuses when both providers respond successfully', async () => {
        const fetcher = jest
            .fn()
            .mockResolvedValueOnce({
                ok: true,
                status: 200,
                text: async () => '',
                json: async () => ({}),
            })
            .mockResolvedValueOnce({
                ok: true,
                status: 200,
                text: async () => '',
                json: async () => ({ ok: true }),
            });

        const result = await getIntegrationsStatus({
            env: {
                WHATSAPP_ACCESS_TOKEN: 'token',
                WHATSAPP_PHONE_NUMBER_ID: '123456',
                TELEGRAM_BOT_TOKEN: 'bot-token',
            },
            fetcher: fetcher as never,
        });

        expect(result).toEqual({
            whatsapp: { configured: true, ok: true },
            telegram: { configured: true, ok: true },
        });
        expect(fetcher).toHaveBeenNthCalledWith(
            1,
            'https://graph.facebook.com/v21.0/123456?fields=id,verified_name,display_phone_number',
            {
                cache: 'no-store',
                headers: { Authorization: 'Bearer token' },
            },
        );
        expect(String(fetcher.mock.calls[0]?.[0])).not.toContain('token');
    });

    test('classifies an inaccessible WhatsApp phone number without exposing provider details', async () => {
        const result = await checkWhatsAppIntegration({
            env: {
                WHATSAPP_ACCESS_TOKEN: 'secret-token',
                WHATSAPP_PHONE_NUMBER_ID: '123456',
            },
            fetcher: jest.fn().mockResolvedValue({
                ok: false,
                status: 400,
                text: async () =>
                    JSON.stringify({
                        error: {
                            message:
                                'Unsupported get request. Object does not exist, cannot be loaded due to missing permissions.',
                        },
                    }),
                json: async () => ({}),
            }) as never,
        });

        expect(result).toEqual({
            configured: true,
            ok: false,
            message: 'У токена нет доступа к настроенному номеру WhatsApp',
        });
    });

    test('returns not configured Telegram status when token is missing', async () => {
        const result = await checkTelegramIntegration({
            env: {},
            fetcher: jest.fn() as never,
        });

        expect(result).toEqual({
            configured: false,
            ok: false,
            message: 'TELEGRAM_BOT_TOKEN не задан',
        });
    });
});
