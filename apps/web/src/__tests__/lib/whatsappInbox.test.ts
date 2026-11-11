import { parseInboxCommand, parseWhatsAppInboxBody } from '@/lib/whatsappInbox/parse';
import { runWhatsAppInboxWorker } from '@/lib/whatsappInbox/worker';
import { ProviderDeliveryError } from '@/lib/notifications/outboxTypes';
import type { InboxLease, WhatsAppInboxStore } from '@/lib/whatsappInbox/types';

const receiver = '123456789';
const message = { id: 'wamid.synthetic', from: '996555000000', type: 'text', timestamp: '1794300000', text: { body: 'подтвердить 2' } };
const payload = (entry = message) => ({ object: 'whatsapp_business_account', entry: [{ changes: [{ value: { metadata: { phone_number_id: receiver }, messages: [entry] } }] }] });

describe('signed inbox parsing', () => {
    test('normalizes only bounded command inputs and hashes timestamp/sender/text', () => {
        const [parsed] = parseWhatsAppInboxBody(payload(), receiver);
        expect(parsed).toMatchObject({ sender: '+996555000000', command: 'confirm', booking_number: 2, receiver });
        expect(parsed.payload_hash).toMatch(/^[a-f0-9]{64}$/);
        expect(parseWhatsAppInboxBody(payload({ ...message, timestamp: '1794300001' }), receiver)[0].payload_hash).not.toBe(parsed.payload_hash);
    });
    test.each(['когда запись', 'подарок', 'не надо подтверждать', 'отмена 1 и подтвердить 2'])('ordinary prose does not mutate: %s', text => {
        expect(parseInboxCommand(text).command).toBe('booking_info');
    });
    test.each([['cancel 0', 'cancel', 0], ['confirm 999', 'confirm', 999], ['отмена 1', 'cancel', 1], ['да', 'confirm', null]])('retains explicit index for validation: %s', (text, command, number) => {
        expect(parseInboxCommand(text as string)).toEqual({ command, booking_number: number });
    });
    test('rejects wrong receiver, malformed timestamps/phone, and oversized batches', () => {
        expect(() => parseWhatsAppInboxBody(payload(), '987')).toThrow();
        expect(() => parseWhatsAppInboxBody(payload({ ...message, timestamp: '123oops' }), receiver)).toThrow();
        expect(() => parseWhatsAppInboxBody(payload({ ...message, from: 'arbitrary' }), receiver)).toThrow();
        const huge = payload(); huge.entry[0].changes[0].value.messages = Array(101).fill(message);
        expect(() => parseWhatsAppInboxBody(huge, receiver)).toThrow();
    });
    test('delivery callbacks have no commands; media becomes a generic acknowledgement', () => {
        expect(parseWhatsAppInboxBody({ object: 'whatsapp_business_account', entry: [{ changes: [{ value: { metadata: { phone_number_id: receiver }, statuses: [{ id: 'receipt' }] } }] }] }, receiver)).toEqual([]);
        expect(parseWhatsAppInboxBody(payload({ ...message, type: 'image' }), receiver)[0]).toMatchObject({ command: 'media', text: '' });
    });
});

const lease: InboxLease = { id: 'inbox', lease_token: 'token', attempts: 1 };
function setup() {
    const store: jest.Mocked<WhatsAppInboxStore> = {
        receive: jest.fn(), claim: jest.fn().mockResolvedValueOnce([lease]).mockResolvedValue([]),
        process: jest.fn().mockResolvedValue({ outcome: 'confirmed', payload: { text: { body: 'saved reply' } } }),
        begin: jest.fn(), receipt: jest.fn(), fail: jest.fn(), release: jest.fn(), prune: jest.fn().mockResolvedValue(0),
    };
    const send = jest.fn().mockResolvedValue('provider-id');
    return { store, send, receiver };
}
describe('durable worker boundaries', () => {
    test('process receipt and send-start precede provider; provider receipt follows', async () => {
        const deps = setup(); const result = await runWhatsAppInboxWorker(deps);
        expect(result).toMatchObject({ claimed: 1, sent: 1, errors: 0 });
        expect(deps.store.process.mock.invocationCallOrder[0]).toBeLessThan(deps.store.begin.mock.invocationCallOrder[0]);
        expect(deps.store.begin.mock.invocationCallOrder[0]).toBeLessThan(deps.send.mock.invocationCallOrder[0]);
        expect(deps.send.mock.invocationCallOrder[0]).toBeLessThan(deps.store.receipt.mock.invocationCallOrder[0]);
    });
    test('unknown command commit retries the durable receipt and never sends in this attempt', async () => {
        const deps = setup(); deps.store.process.mockRejectedValue(new Error('DB timeout'));
        await runWhatsAppInboxWorker(deps);
        expect(deps.send).not.toHaveBeenCalled();
        expect(deps.store.fail).toHaveBeenCalledWith(lease, 'retry', 'command_database_failed');
    });
    test('failed begin and accepted-send receipt loss never become retryable provider failure', async () => {
        const deps = setup(); deps.store.begin.mockRejectedValueOnce(new Error('unknown begin'));
        expect((await runWhatsAppInboxWorker(deps)).errors).toBe(1);
        expect(deps.send).not.toHaveBeenCalled(); expect(deps.store.fail).not.toHaveBeenCalled();
        const accepted = setup(); accepted.store.receipt.mockRejectedValue(new Error('lost ack'));
        expect((await runWhatsAppInboxWorker(accepted)).errors).toBe(1);
        expect(accepted.send).toHaveBeenCalledTimes(1); expect(accepted.store.fail).not.toHaveBeenCalled();
    });
    test.each([['retry', 'provider_rate_limited'], ['ambiguous', 'provider_outcome_unknown'], ['failed', 'provider_http_400']] as const)('persists provider outcome %s', async (outcome, code) => {
        const deps = setup(); deps.send.mockRejectedValue(new ProviderDeliveryError(code, outcome, 30));
        await runWhatsAppInboxWorker(deps);
        expect(deps.store.fail).toHaveBeenCalledWith(lease, outcome, code, 30);
        expect(deps.store.receipt).not.toHaveBeenCalled(); expect(deps.send).toHaveBeenCalledTimes(1);
    });
    test('bounds batches to four concurrent events and twenty per invocation', async () => {
        const deps = setup(); deps.store.claim.mockReset().mockResolvedValue(Array(4).fill(lease));
        const result = await runWhatsAppInboxWorker({ ...deps, now: () => 0 });
        expect(result.claimed).toBe(20); expect(deps.store.claim).toHaveBeenCalledTimes(5);
        expect(deps.store.claim.mock.calls.every(call => call[1] === 4)).toBe(true);
    });
    test('releases an unstarted lease when request budget cannot fit another send', async () => {
        const deps = setup(); const now = jest.fn().mockReturnValueOnce(0).mockReturnValueOnce(0).mockReturnValue(21_000);
        await runWhatsAppInboxWorker({ ...deps, now });
        expect(deps.store.release).toHaveBeenCalledWith(lease); expect(deps.send).not.toHaveBeenCalled();
    });
});
