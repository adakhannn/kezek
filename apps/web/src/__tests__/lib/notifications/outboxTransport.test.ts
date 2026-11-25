import { sendOutboxDelivery, PROVIDER_DEADLINE_MS } from '@/lib/notifications/outboxTransport';
import type { StoredDelivery } from '@/lib/notifications/outboxTypes';
import { getExpoAccessToken, getResendApiKey, getWhatsAppAccessToken, getWhatsAppPhoneNumberId } from '@/lib/env';
import { logWarn } from '@/lib/log';

jest.mock('@/lib/env', () => ({
    getResendApiKey: jest.fn(), getWhatsAppAccessToken: jest.fn(), getWhatsAppPhoneNumberId: jest.fn(), getExpoAccessToken: jest.fn(() => ''),
}));
jest.mock('@/lib/log', () => ({ logWarn: jest.fn(), logError: jest.fn(), logDebug: jest.fn() }));
const delivery = (channel: StoredDelivery['channel']): StoredDelivery => ({ delivery_key: `${channel}:${'a'.repeat(64)}`, channel,
    payload: { to: 'synthetic-recipient', text: 'immutable message' }, status: 'sending', sent_at: null, first_attempt_at: null, last_error_code: null });
const response = (status: number, body: unknown, retryAfter?: string) => ({ ok: status >= 200 && status < 300, status,
    headers: new Headers(retryAfter ? { 'retry-after': retryAfter } : {}), json: async () => body }) as Response;
beforeEach(() => {
    process.env.TELEGRAM_BOT_TOKEN = 'synthetic-telegram-secret';
    jest.mocked(getResendApiKey).mockReturnValue('synthetic-resend-secret');
    jest.mocked(getWhatsAppAccessToken).mockReturnValue('synthetic-whatsapp-secret');
    jest.mocked(getWhatsAppPhoneNumberId).mockReturnValue('synthetic-phone-id');
});
afterEach(() => { jest.useRealTimers(); });

test('Resend retries use identical payload and stable Idempotency-Key', async () => {
    const fetchImpl = jest.fn().mockResolvedValue(response(200, { id: 'same-provider-id' }));
    expect(await sendOutboxDelivery('event-id', delivery('email'), fetchImpl)).toBe('same-provider-id');
    expect(await sendOutboxDelivery('event-id', delivery('email'), fetchImpl)).toBe('same-provider-id');
    expect(fetchImpl.mock.calls[0][1].body).toBe(fetchImpl.mock.calls[1][1].body);
    expect(fetchImpl.mock.calls[0][1].headers['Idempotency-Key']).toBe(`booking/event-id/email:${'a'.repeat(64)}`);
    expect(fetchImpl.mock.calls[1][1].headers['Idempotency-Key']).toBe(fetchImpl.mock.calls[0][1].headers['Idempotency-Key']);
});

test.each(['email', 'telegram', 'whatsapp'] as const)('bounded %s provider deadline covers a stalled response body', async channel => {
    jest.useFakeTimers();
    const fetchImpl = jest.fn().mockResolvedValue({ ...response(200, {}), json: () => new Promise(() => undefined) });
    const sending = sendOutboxDelivery('event', delivery(channel), fetchImpl);
    const expected = expect(sending).rejects.toMatchObject({ code: 'provider_outcome_unknown', outcome: channel === 'email' ? 'retry' : 'ambiguous' });
    await jest.advanceTimersByTimeAsync(PROVIDER_DEADLINE_MS);
    await expected;
    expect(fetchImpl.mock.calls[0][1].signal.aborted).toBe(true);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
});

test.each(['email', 'telegram', 'whatsapp'] as const)('known 429 for %s preserves retry-after and is retryable', async channel => {
    const fetchImpl = jest.fn().mockResolvedValue(response(429, {}, '120'));
    await expect(sendOutboxDelivery('event', delivery(channel), fetchImpl)).rejects.toMatchObject({ outcome: 'retry', retryAfterSeconds: 120 });
});

test.each([
    [409, { name: 'concurrent_idempotent_requests' }, 'retry'],
    [409, { name: 'invalid_idempotent_request' }, 'failed'],
    [400, { message: 'private recipient details' }, 'failed'],
    [503, {}, 'retry'],
] as const)('Resend HTTP %s maps provider outcome without leaking raw error text', async (status, body, outcome) => {
    const fetchImpl = jest.fn().mockResolvedValue(response(status, body));
    await expect(sendOutboxDelivery('event', delivery('email'), fetchImpl)).rejects.toMatchObject({ outcome });
    try { await sendOutboxDelivery('event', delivery('email'), fetchImpl); } catch (error) { expect(String(error)).not.toContain('private recipient'); }
});

test('missing success receipt is uncertain, not sent', async () => {
    await expect(sendOutboxDelivery('event', delivery('telegram'), jest.fn().mockResolvedValue(response(200, { ok: true, result: {} })))).rejects.toMatchObject({ outcome: 'ambiguous' });
});

test('missing configuration makes no provider request and remains retryable', async () => {
    delete process.env.TELEGRAM_BOT_TOKEN;
    const fetchImpl = jest.fn();
    await expect(sendOutboxDelivery('event', delivery('telegram'), fetchImpl)).rejects.toMatchObject({ code: 'provider_config_missing', outcome: 'retry' });
    expect(fetchImpl).not.toHaveBeenCalled();
});

test.each(['resend', 'whatsapp-token', 'whatsapp-phone', 'telegram'] as const)('blank %s configuration is rejected before fetch', async setting => {
    if (setting === 'resend') jest.mocked(getResendApiKey).mockReturnValue(' ');
    if (setting === 'whatsapp-token') jest.mocked(getWhatsAppAccessToken).mockReturnValue('');
    if (setting === 'whatsapp-phone') jest.mocked(getWhatsAppPhoneNumberId).mockReturnValue(' ');
    if (setting === 'telegram') process.env.TELEGRAM_BOT_TOKEN = ' ';
    const channel = setting === 'resend' ? 'email' : setting === 'telegram' ? 'telegram' : 'whatsapp';
    const fetchImpl = jest.fn();
    await expect(sendOutboxDelivery('event', delivery(channel), fetchImpl)).rejects.toMatchObject({ code: 'provider_config_missing', outcome: 'retry' });
    expect(fetchImpl).not.toHaveBeenCalled();
});

describe('Expo push', () => {
    const TOKEN = 'ExponentPushToken[synthetic-install-0001]';
    const push = (): StoredDelivery => ({ ...delivery('push'), payload: { to: TOKEN, title: 'Booking confirmed', body: 'Business', data: { bookingId: 'b', type: 'confirm' } } });
    afterEach(() => { jest.mocked(getExpoAccessToken).mockReturnValue(''); });

    test('one message is posted as a list of one to the Expo push API; the ticket id is the provider id', async () => {
        const fetchImpl = jest.fn().mockResolvedValue(response(200, { data: [{ status: 'ok', id: 'ticket-1' }] }));
        expect(await sendOutboxDelivery('event', push(), fetchImpl)).toBe('ticket-1');
        const [url, init] = fetchImpl.mock.calls[0];
        expect(url).toBe('https://exp.host/--/api/v2/push/send');
        expect(JSON.parse(init.body)).toEqual([push().payload]);
        expect(init.headers.Authorization).toBeUndefined();
    });

    test('EXPO_ACCESS_TOKEN, when set, is sent as a Bearer token', async () => {
        jest.mocked(getExpoAccessToken).mockReturnValue('synthetic-expo-secret');
        const fetchImpl = jest.fn().mockResolvedValue(response(200, { data: [{ status: 'ok', id: 'ticket-1' }] }));
        await sendOutboxDelivery('event', push(), fetchImpl);
        expect(fetchImpl.mock.calls[0][1].headers.Authorization).toBe('Bearer synthetic-expo-secret');
    });

    test('DeviceNotRegistered removes the token and fails the delivery with its own code', async () => {
        const removePushToken = jest.fn().mockResolvedValue(undefined);
        const fetchImpl = jest.fn().mockResolvedValue(response(200, { data: [{ status: 'error', message: 'private details', details: { error: 'DeviceNotRegistered' } }] }));
        await expect(sendOutboxDelivery('event', push(), fetchImpl, { removePushToken })).rejects.toMatchObject({ code: 'push_device_not_registered', outcome: 'failed' });
        expect(removePushToken).toHaveBeenCalledWith(TOKEN);
    });

    test('a failed token removal is logged with a masked token and does not change the outcome', async () => {
        const removePushToken = jest.fn().mockRejectedValue(new Error('db down'));
        const fetchImpl = jest.fn().mockResolvedValue(response(200, { data: [{ status: 'error', details: { error: 'DeviceNotRegistered' } }] }));
        await expect(sendOutboxDelivery('event', push(), fetchImpl, { removePushToken })).rejects.toMatchObject({ code: 'push_device_not_registered' });
        expect(JSON.stringify(jest.mocked(logWarn).mock.calls)).not.toContain('synthetic-install-0001');
    });

    test.each([
        [{ status: 'error', details: { error: 'MessageRateExceeded' } }, 'provider_rate_limited', 'retry'],
        [{ status: 'error', details: { error: 'InvalidCredentials' } }, 'push_InvalidCredentials', 'failed'],
        [{ status: 'error', message: 'no details' }, 'push_ticket_error', 'failed'],
        [{ status: 'ok' }, 'provider_outcome_unknown', 'ambiguous'],
    ])('ticket %j maps to %s / %s', async (ticket, code, outcome) => {
        const fetchImpl = jest.fn().mockResolvedValue(response(200, { data: [ticket] }));
        await expect(sendOutboxDelivery('event', push(), fetchImpl)).rejects.toMatchObject({ code, outcome });
    });

    test.each([[429, 'retry'], [503, 'ambiguous'], [400, 'failed']] as const)('HTTP %s maps to %s (Expo does not deduplicate a repeated request)', async (status, outcome) => {
        const fetchImpl = jest.fn().mockResolvedValue(response(status, { errors: [{ code: 'X' }] }));
        await expect(sendOutboxDelivery('event', push(), fetchImpl)).rejects.toMatchObject({ outcome });
    });
});
