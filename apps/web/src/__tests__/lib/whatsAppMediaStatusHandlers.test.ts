jest.mock('@/lib/log', () => ({
    logDebug: jest.fn(),
    logError: jest.fn(),
}));

jest.mock('@/lib/senders/whatsapp', () => ({
    sendWhatsApp: jest.fn(),
}));

import { sendWhatsApp } from '@/lib/senders/whatsapp';
import {
    handleIncomingWhatsAppMediaMessage,
    logWhatsAppStatusUpdate,
} from '@/lib/whatsAppMediaStatusHandlers';

describe('whatsAppMediaStatusHandlers', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    test('sends a confirmation for media messages', async () => {
        await handleIncomingWhatsAppMediaMessage(
            {
                id: 'message-1',
                type: 'document',
                document: { filename: 'price.pdf' },
            },
            '+7700',
            'booking-1',
        );

        expect(sendWhatsApp).toHaveBeenCalledWith({
            to: '+7700',
            text: expect.stringContaining('Документ: price.pdf'),
        });
    });

    test('logs status updates without throwing', () => {
        expect(() =>
            logWhatsAppStatusUpdate({
                id: 'message-1',
                status: 'read',
                recipient_id: 'client-1',
            }),
        ).not.toThrow();
    });
});
