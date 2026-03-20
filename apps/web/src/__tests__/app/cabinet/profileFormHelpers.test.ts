import {
    createInitialProfile,
    createProfileUpdatePayload,
    isTelegramAlreadyLinkedError,
    mapProfileFromSources,
    sanitizeOtpCode,
} from '@/app/cabinet/components/profileFormHelpers';

describe('profileFormHelpers', () => {
    test('creates initial profile defaults', () => {
        expect(createInitialProfile()).toEqual({
            full_name: null,
            phone: null,
            notify_email: true,
            notify_whatsapp: true,
            whatsapp_verified: false,
            notify_telegram: true,
            telegram_connected: false,
        });
    });

    test('maps profile and user metadata into form state', () => {
        expect(
            mapProfileFromSources(
                {
                    full_name: 'Ada',
                    phone: '+996555123456',
                    notify_email: false,
                    notify_whatsapp: true,
                    whatsapp_verified: true,
                    notify_telegram: true,
                    telegram_id: 123,
                    telegram_verified: true,
                },
                { telegram_id: null },
            ),
        ).toMatchObject({
            full_name: 'Ada',
            phone: '+996555123456',
            notify_email: false,
            notify_whatsapp: true,
            whatsapp_verified: true,
            notify_telegram: true,
            telegram_connected: true,
        });
    });

    test('creates normalized update payload', () => {
        expect(
            createProfileUpdatePayload({
                ...createInitialProfile(),
                full_name: '',
                phone: '',
                notify_email: false,
            }),
        ).toEqual({
            full_name: null,
            phone: null,
            notify_email: false,
            notify_whatsapp: true,
            notify_telegram: true,
        });
    });

    test('sanitizes otp input', () => {
        expect(sanitizeOtpCode('12a34-5678')).toBe('123456');
    });

    test('detects already-linked telegram error', () => {
        expect(isTelegramAlreadyLinkedError('Этот Telegram уже привязан к другому пользователю')).toBe(true);
        expect(isTelegramAlreadyLinkedError('other error')).toBe(false);
    });
});
