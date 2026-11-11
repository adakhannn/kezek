/** HTTP authenticates and persists only. Real phone ownership/transitions run in the isolated SQL gate. */
jest.mock('@/lib/notifications/outboxStore', () => ({ createOutboxAdminClient: jest.fn() }));
import { NextRequest } from 'next/server';
import { createHmac } from 'node:crypto';
import { GET, POST } from '@/app/api/webhooks/whatsapp/route';
import { createOutboxAdminClient } from '@/lib/notifications/outboxStore';
const savedEnv = process.env;
const rpc = jest.fn();
const abortSignal = jest.fn();
const receiver = '123456789';
const incoming = (type = 'text') => ({ object: 'whatsapp_business_account', entry: [{ changes: [{ value: {
    metadata: { phone_number_id: receiver }, messages: [{ id: 'wamid.synthetic', from: '996555000000', type, timestamp: '1794300000', text: { body: 'отмена' } }],
} }] }] });
const request = (body: unknown, signature = true) => {
    const raw = JSON.stringify(body);
    return new NextRequest('https://example.invalid/api/webhooks/whatsapp', { method: 'POST', body: raw,
        headers: signature ? { 'x-hub-signature-256': 'sha256=' + createHmac('sha256', 'unit-secret').update(raw).digest('hex') } : {} });
};
beforeEach(() => {
    jest.clearAllMocks();
    process.env = { ...savedEnv, WHATSAPP_VERIFY_TOKEN: 'verify-unit', WHATSAPP_APP_SECRET: 'unit-secret', WHATSAPP_PHONE_NUMBER_ID: receiver };
    abortSignal.mockResolvedValue({ data: 1, error: null }); rpc.mockReturnValue({ abortSignal });
    jest.mocked(createOutboxAdminClient).mockReturnValue({ rpc } as unknown as ReturnType<typeof createOutboxAdminClient>);
});
afterEach(() => { process.env = savedEnv; });
test('valid subscription challenge', async () => {
    const response = await GET(new NextRequest('https://example.invalid/api/webhooks/whatsapp?hub.mode=subscribe&hub.verify_token=verify-unit&hub.challenge=challenge'));
    expect(response.status).toBe(200); expect(await response.text()).toBe('challenge');
});
test.each(['hub.mode=unsubscribe&hub.verify_token=verify-unit', 'hub.mode=subscribe&hub.verify_token=wrong'])('invalid challenge %s', async params => {
    expect((await GET(new NextRequest('https://example.invalid/api/webhooks/whatsapp?' + params + '&hub.challenge=x'))).status).toBe(403);
});
test.each(['text', 'image'])('persist %s before 200, without executing command or sending reply', async type => {
    const response = await POST(request(incoming(type)));
    expect(response.status).toBe(200); expect((await response.json()).success).toBe(true);
    expect(rpc).toHaveBeenCalledTimes(1);
    expect(rpc).toHaveBeenCalledWith('receive_whatsapp_inbox', { p_receiver: receiver, p_messages: [expect.objectContaining({ sender: '+996555000000', receiver, command: type === 'text' ? 'cancel' : 'media' })] });
    expect(abortSignal).toHaveBeenCalledWith(expect.any(AbortSignal));
});
test('DB failure returns 503 so provider redelivery can recover the message', async () => {
    abortSignal.mockResolvedValue({ data: null, error: { message: 'DB offline' } });
    expect((await POST(request(incoming()))).status).toBe(503);
});
test('persist is awaited; uncertain commit is not acknowledged early', async () => {
    let resolve!: (value: unknown) => void;
    abortSignal.mockReturnValue(new Promise(done => { resolve = done; }));
    let completed = false;
    const pending = POST(request(incoming())).then(response => { completed = true; return response; });
    for (let index = 0; index < 10 && !resolve; index++) await Promise.resolve();
    expect(completed).toBe(false);
    resolve({ data: 1, error: null }); expect((await pending).status).toBe(200);
});
test('durable duplicates acknowledge, conflicting payload does not', async () => {
    abortSignal.mockResolvedValueOnce({ data: 0, error: null });
    expect((await POST(request(incoming()))).status).toBe(200);
    abortSignal.mockResolvedValueOnce({ data: null, error: { message: 'INBOX_PAYLOAD_CONFLICT' } });
    expect((await POST(request(incoming()))).status).toBe(409);
});
test('signature and receiver failures happen before privileged client creation', async () => {
    expect((await POST(request(incoming(), false))).status).toBe(403);
    const wrong = incoming(); wrong.entry[0].changes[0].value.metadata.phone_number_id = '987';
    expect((await POST(request(wrong))).status).toBe(400);
    expect(createOutboxAdminClient).not.toHaveBeenCalled();
});
test('status-only callback does not create a command or turn ambiguous delivery into resend', async () => {
    const body = { object: 'whatsapp_business_account', entry: [{ changes: [{ value: { metadata: { phone_number_id: receiver }, statuses: [{ id: 'receipt', status: 'delivered' }] } }] }] };
    expect((await POST(request(body))).status).toBe(200); expect(rpc).not.toHaveBeenCalled();
});
test('receiver configuration missing fails closed', async () => {
    delete process.env.WHATSAPP_PHONE_NUMBER_ID;
    expect((await POST(request(incoming()))).status).toBe(503); expect(rpc).not.toHaveBeenCalled();
});
