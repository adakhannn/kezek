jest.mock('@/lib/env', () => ({
    getWhatsAppVerifyToken: jest.fn(() => 'test_verify_token'),
}));

jest.mock('@/lib/whatsAppWebhookService', () => ({
    processWhatsAppWebhookBody: jest.fn(),
}));

import { NextRequest } from 'next/server';
import { createHmac } from 'node:crypto';

import {
    runWhatsAppWebhookGetHttp,
    runWhatsAppWebhookPostHttp,
} from '@/lib/whatsAppWebhookHttpService';
import { processWhatsAppWebhookBody } from '@/lib/whatsAppWebhookService';

describe('whatsAppWebhookHttpService', () => {
    const previousSecret = process.env.WHATSAPP_APP_SECRET;
    const secret = 'unit-test-app-secret';
    const signedRequest = (raw: string, signedBody = raw) => new NextRequest('http://localhost/api/webhooks/whatsapp', {
        method: 'POST', body: raw,
        headers: { 'x-hub-signature-256': `sha256=${createHmac('sha256', secret).update(signedBody).digest('hex')}` },
    });
    beforeEach(() => {
        jest.clearAllMocks();
        process.env.WHATSAPP_APP_SECRET = secret;
    });
    afterAll(() => {
        if (previousSecret === undefined) delete process.env.WHATSAPP_APP_SECRET;
        else process.env.WHATSAPP_APP_SECRET = previousSecret;
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
            signedRequest(JSON.stringify(payload)),
        );
        const body = await response.json();

        expect(processWhatsAppWebhookBody).toHaveBeenCalledWith(payload);
        expect(response.status).toBe(200);
        expect(body.success).toBe(true);
    });

    test.each([undefined, 'sha1=123', 'sha256=bad', `sha256=${'0'.repeat(64)}`])('rejects missing/malformed/invalid signature %p before processing', async signature => {
        const response = await runWhatsAppWebhookPostHttp(new NextRequest('http://localhost/api/webhooks/whatsapp', {
            method: 'POST', body: '{broken', headers: signature ? { 'x-hub-signature-256': signature } : {},
        }));
        expect(response.status).toBe(403);
        expect(processWhatsAppWebhookBody).not.toHaveBeenCalled();
    });

    test('authenticates original bytes, including whitespace and Unicode', async () => {
        const raw = '{ "object": "whatsapp_business_account", "text": "Привет" }';
        expect((await runWhatsAppWebhookPostHttp(signedRequest(raw, JSON.stringify(JSON.parse(raw))))).status).toBe(403);
        expect(processWhatsAppWebhookBody).not.toHaveBeenCalled();
        expect((await runWhatsAppWebhookPostHttp(signedRequest(raw))).status).toBe(200);
        expect(processWhatsAppWebhookBody).toHaveBeenCalledWith(JSON.parse(raw));
    });

    test('returns 400 for authenticated invalid JSON without processing', async () => {
        expect((await runWhatsAppWebhookPostHttp(signedRequest('{broken'))).status).toBe(400);
        expect(processWhatsAppWebhookBody).not.toHaveBeenCalled();
    });

    test('fails closed when the app secret is absent', async () => {
        delete process.env.WHATSAPP_APP_SECRET;
        expect((await runWhatsAppWebhookPostHttp(signedRequest('{}'))).status).toBe(503);
        expect(processWhatsAppWebhookBody).not.toHaveBeenCalled();
    });

    test('bounds raw bytes before parsing or persistence even without Content-Length', async () => {
        expect((await runWhatsAppWebhookPostHttp(signedRequest('x'.repeat(524289)))).status).toBe(400);
        expect(processWhatsAppWebhookBody).not.toHaveBeenCalled();
    });
});
