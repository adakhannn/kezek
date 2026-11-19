import { authEn } from '@/app/_components/i18n/dictionaries/auth.en';
import { toSafeAuthMessage } from '@/lib/authUserMessages';

// The Russian fallback, as t() gives it without a translation; en is the real dictionary (FE-10).
const ru = (_key: string, fallback: string) => fallback;
const en = (key: keyof typeof authEn) => authEn[key];

describe('authUserMessages', () => {
    test('maps missing session to a recovery-safe message', () => {
        expect(toSafeAuthMessage(new Error('Auth session missing!'), ru)).toContain(
            'Сессия не найдена',
        );
    });

    test('maps expired or invalid token messages without exposing provider text', () => {
        const message = toSafeAuthMessage(new Error('Token has expired or is invalid'), ru);

        expect(message).toContain('Код или ссылка недействительны');
        expect(message).not.toContain('Token');
    });

    test('maps rate limit messages to retry guidance', () => {
        expect(toSafeAuthMessage(new Error('over_email_send_rate_limit'), ru)).toContain(
            'Слишком много попыток',
        );
    });

    test('maps signups-disabled user discovery to a non-enumerating message', () => {
        const message = toSafeAuthMessage(new Error('Signups not allowed for otp'), ru);

        expect(message).toContain('Если аккаунт существует');
        expect(message).not.toContain('Signups');
    });

    test('maps provider email validation text to a localized message', () => {
        const message = toSafeAuthMessage(new Error('Email address "test@example.com" is invalid'), ru);

        expect(message).toBe('Введите корректный e-mail адрес.');
        expect(toSafeAuthMessage(new Error('Email address "test@example.com" is invalid'), en)).toBe('Enter a valid email address.');
    });
});
