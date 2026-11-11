import { sendOutboxDelivery, PROVIDER_DEADLINE_MS } from '@/lib/notifications/outboxTransport';
import type { StoredDelivery } from '@/lib/notifications/outboxTypes';
import { getResendApiKey, getWhatsAppAccessToken, getWhatsAppPhoneNumberId } from '@/lib/env';

jest.mock('@/lib/env', () => ({
    getResendApiKey: jest.fn(), getWhatsAppAccessToken: jest.fn(), getWhatsAppPhoneNumberId: jest.fn(),
}));
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
