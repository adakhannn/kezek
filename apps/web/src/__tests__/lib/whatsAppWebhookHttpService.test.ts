jest.mock('@/lib/env', () => ({
    getWhatsAppVerifyToken: jest.fn(() => 'test_verify_token'),
}));

jest.mock('@/lib/whatsAppWebhookService', () => ({
    processWhatsAppWebhookBody: jest.fn(),
}));

import { NextRequest } from 'next/server';

import {
    runWhatsAppWebhookGetHttp,
    runWhatsAppWebhookPostHttp,
} from '@/lib/whatsAppWebhookHttpService';
import { processWhatsAppWebhookBody } from '@/lib/whatsAppWebhookService';

describe('whatsAppWebhookHttpService', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    test('returns challenge for valid verification request', async () => {
        const response = await runWhatsAppWebhookGetHttp(
            new NextRequest(
                'http://localhost/api/webhooks/whatsapp?hub.mode=subscribe&hub.verify_token=test_verify_token&hub.challenge=challenge-123',
            ),
        );

        expect(response.status).toBe(200);
        await expect(response.text()).resolves.toBe('challenge-123');
    });

    test('returns forbidden for invalid verification request', async () => {
        const response = await runWhatsAppWebhookGetHttp(
            new NextRequest(
                'http://localhost/api/webhooks/whatsapp?hub.mode=subscribe&hub.verify_token=wrong&hub.challenge=challenge-123',
            ),
        );
        const body = await response.json();

        expect(response.status).toBe(403);
        expect(body.error).toBe('forbidden');
    });

    test('delegates webhook body processing on post', async () => {
        const payload = { object: 'whatsapp_business_account' };

        const response = await runWhatsAppWebhookPostHttp(
            new NextRequest('http://localhost/api/webhooks/whatsapp', {
                method: 'POST',
                body: JSON.stringify(payload),
            }),
        );
        const body = await response.json();

        expect(processWhatsAppWebhookBody).toHaveBeenCalledWith(payload);
        expect(response.status).toBe(200);
        expect(body.success).toBe(true);
    });
});
