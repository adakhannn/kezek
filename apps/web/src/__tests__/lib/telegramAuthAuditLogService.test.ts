import {
    writeTelegramAuthAuditEventWithAdmin,
    type TelegramAuthAuditEvent,
} from '@/lib/telegramAuthAuditLogService';

describe('telegramAuthAuditLogService', () => {
    test('inserts normalized payload to telegram_auth_audit_log', async () => {
        const insert = jest.fn().mockResolvedValue({ error: null });
        const admin = {
            from: jest.fn().mockReturnValue({
                insert,
            }),
        };

        const event: TelegramAuthAuditEvent = {
            eventType: 'bot_login_approved',
            nonce: 'nonce-123',
            telegramId: 12345,
            decision: 'approve',
            status: 'approved',
            linkage: 'existing',
            metadata: { foo: 'bar' },
        };

        await writeTelegramAuthAuditEventWithAdmin(admin as never, event);

        expect(admin.from).toHaveBeenCalledWith('telegram_auth_audit_log');
        expect(insert).toHaveBeenCalledWith({
            event_type: 'bot_login_approved',
            nonce: 'nonce-123',
            telegram_id: 12345,
            decision: 'approve',
            status: 'approved',
            user_id: null,
            linkage: 'existing',
            reason: null,
            metadata: { foo: 'bar' },
        });
    });
});
