import { notifyStaffApplicationSubmitted } from '@/lib/businessRoleApplicationNotificationService';
import { sendTelegram } from '@/lib/senders/telegram';
import { sendWhatsApp } from '@/lib/senders/whatsapp';
import { sendEmail } from '@/lib/senders/email';

jest.mock('@/lib/senders/telegram', () => ({ sendTelegram: jest.fn().mockResolvedValue({}) }));
jest.mock('@/lib/senders/whatsapp', () => ({ sendWhatsApp: jest.fn().mockResolvedValue({}) }));
jest.mock('@/lib/senders/email', () => ({ sendEmail: jest.fn().mockResolvedValue({}) }));
jest.mock('@/lib/log', () => ({ logError: jest.fn() }));

describe('staff application delivery', () => {
    const original = process.env;
    beforeEach(() => {
        jest.clearAllMocks();
        process.env = { ...original, NODE_ENV: 'development', NEXT_PUBLIC_SITE_ORIGIN: 'https://kezek.kg', LOCAL_AUTH_PUBLIC_ORIGIN: 'https://test.trycloudflare.com', WHATSAPP_STAFF_APPLICATION_OWNER_TEMPLATE_NAME: 'kezek_staff_application_owner', WHATSAPP_APPLICATION_NAMED_PARAMETERS: '{"staff_owner":["business_name","applicant_name"]}' };
    });
    afterEach(() => { process.env = original; });
    const admin = {
        from(table: string) {
            let id = '';
            return {
                select() { return this; },
                eq(key: string, value: string) { if (key === 'id') id = value; return this; },
                async maybeSingle() {
                    return { data: table === 'businesses' ? { name: 'Test business', owner_id: 'owner' } : { notify_email: false, notify_telegram: true, telegram_verified: true, telegram_id: id === 'owner' ? 1 : 2, notify_whatsapp: id === 'owner', whatsapp_verified: true, whatsapp_phone: '+996555000000' } };
                },
                then(resolve: (value: unknown) => unknown) { return Promise.resolve(resolve({ data: [] })); },
            };
        },
        auth: { admin: { getUserById: jest.fn().mockResolvedValue({ data: { user: {} }, error: null }) } },
    };
    const application = { id: 'application', businessId: 'biz', origin: 'https://localhost:3000', applicant: { id: 'staff', name: 'Person' } };
    test('both Telegram recipients get public URLs and owner WhatsApp gets named values', async () => {
        await notifyStaffApplicationSubmitted(admin, application);
        expect(sendTelegram).toHaveBeenCalledTimes(2);
        for (const [message] of (sendTelegram as jest.Mock).mock.calls) {
            expect(message.text).toContain('https://test.trycloudflare.com/');
            expect(message.text).not.toContain('localhost');
        }
        expect(sendWhatsApp).toHaveBeenCalledTimes(1);
        expect(sendWhatsApp).toHaveBeenCalledWith(expect.objectContaining({ template: expect.objectContaining({ name: 'kezek_staff_application_owner', components: [{ type: 'body', parameters: [{ type: 'text', text: 'Test business', parameter_name: 'business_name' }, { type: 'text', text: 'Person', parameter_name: 'applicant_name' }] }] }) }));
        expect(sendEmail).not.toHaveBeenCalled();
    });
    test('bad WhatsApp config cannot stop independent Telegram delivery', async () => {
        process.env.WHATSAPP_APPLICATION_NAMED_PARAMETERS = '{';
        await expect(notifyStaffApplicationSubmitted(admin, application)).resolves.toBeUndefined();
        expect(sendTelegram).toHaveBeenCalledTimes(2);
        expect(sendWhatsApp).not.toHaveBeenCalled();
    });
});
