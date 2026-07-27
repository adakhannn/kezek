import {
    isUsableAccountEmail,
    selectBusinessApplicationEmail,
} from '@/lib/businessApplicationDefaults';

describe('businessApplicationDefaults', () => {
    test('uses the real primary account email first', () => {
        expect(selectBusinessApplicationEmail({
            accountEmail: 'Owner@Example.com',
            notificationEmails: [
                { email: 'google@example.com', verified: true, enabled: true },
            ],
        })).toBe('owner@example.com');
    });

    test('falls back to an enabled verified provider email for WhatsApp accounts', () => {
        expect(selectBusinessApplicationEmail({
            accountEmail: '996770574029@whatsapp.kezek.kg',
            notificationEmails: [
                { email: 'disabled@example.com', verified: true, enabled: false },
                { email: 'owner@gmail.com', verified: true, enabled: true },
            ],
        })).toBe('owner@gmail.com');
    });

    test('does not expose the internal WhatsApp address', () => {
        expect(isUsableAccountEmail('996770574029@whatsapp.kezek.kg')).toBe(false);
        expect(selectBusinessApplicationEmail({
            accountEmail: '996770574029@whatsapp.kezek.kg',
            notificationEmails: [],
        })).toBe('');
    });
});
