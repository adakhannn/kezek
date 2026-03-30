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
