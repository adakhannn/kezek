jest.mock('@/lib/log', () => ({
    logDebug: jest.fn(),
    logError: jest.fn(),
    logWarn: jest.fn(),
}));

import {
    hasPersistedWhatsAppStatus,
    isWhatsAppMessageAlreadyProcessed,
    markWhatsAppMessageProcessed,
    persistIncomingWhatsAppMessage,
} from '@/lib/whatsAppMessagePersistence';

function createQueryBuilder() {
    const query = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        maybeSingle: jest.fn(),
        insert: jest.fn(),
        update: jest.fn().mockReturnThis(),
    };

    return query;
}

describe('whatsAppMessagePersistence', () => {
    test('detects already processed messages', async () => {
        const query = createQueryBuilder();
        query.maybeSingle.mockResolvedValue({ data: { id: 'row-1' } });
        const supabase = { from: jest.fn().mockReturnValue(query) } as any;

        await expect(
            isWhatsAppMessageAlreadyProcessed(supabase, 'message-1'),
        ).resolves.toBe(true);
    });

    test('persists incoming messages', async () => {
        const query = createQueryBuilder();
        query.insert.mockResolvedValue({ error: null });
        const supabase = { from: jest.fn().mockReturnValue(query) } as any;

        await expect(
            persistIncomingWhatsAppMessage(supabase, {
                whatsapp_message_id: 'message-1',
                from_phone: '+7700',
                message_type: 'text',
                message_text: 'hello',
                message_timestamp: '2026-03-31T10:00:00.000Z',
                client_id: null,
                booking_id: null,
                biz_id: null,
                raw_data: {},
                processed: false,
            }),
        ).resolves.toBe(true);
    });

    test('marks messages as processed', async () => {
        const query = createQueryBuilder();
        const supabase = { from: jest.fn().mockReturnValue(query) } as any;

        await markWhatsAppMessageProcessed(supabase, 'message-1');

        expect(query.update).toHaveBeenCalledWith({ processed: true });
        expect(query.eq).toHaveBeenCalledWith('whatsapp_message_id', 'message-1');
    });

    test('checks persisted statuses by message id', async () => {
        const query = createQueryBuilder();
        query.maybeSingle.mockResolvedValue({ data: { id: 'row-1' } });
        const supabase = { from: jest.fn().mockReturnValue(query) } as any;

        await expect(hasPersistedWhatsAppStatus(supabase, 'message-1')).resolves.toBe(
            true,
        );
    });
});
