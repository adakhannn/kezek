import { toSafeAuthMessage } from '@/lib/authUserMessages';

describe('authUserMessages', () => {
    test('maps missing session to a recovery-safe message', () => {
        expect(toSafeAuthMessage(new Error('Auth session missing!'))).toContain(
            'Сессия не найдена',
        );
    });

    test('maps expired or invalid token messages without exposing provider text', () => {
        const message = toSafeAuthMessage(new Error('Token has expired or is invalid'));

        expect(message).toContain('Код или ссылка недействительны');
        expect(message).not.toContain('Token');
    });

    test('maps rate limit messages to retry guidance', () => {
        expect(toSafeAuthMessage(new Error('over_email_send_rate_limit'))).toContain(
            'Слишком много попыток',
        );
    });

    test('maps signups-disabled user discovery to a non-enumerating message', () => {
        const message = toSafeAuthMessage(new Error('Signups not allowed for otp'));

        expect(message).toContain('Если аккаунт существует');
        expect(message).not.toContain('Signups');
    });

    test('maps provider email validation text to a localized message', () => {
        const message = toSafeAuthMessage(new Error('Email address "test@example.com" is invalid'));

        expect(message).toBe('Введите корректный e-mail адрес.');
    });
});
