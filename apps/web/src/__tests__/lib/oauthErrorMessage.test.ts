import { authEn } from '@/app/_components/i18n/dictionaries/auth.en';
import { getOAuthErrorMessage } from '@/lib/oauthErrorMessage';

// The Russian fallback, as t() gives it without a translation; en is the real dictionary (FE-10).
const ru = (_key: string, fallback: string) => fallback;
const en = (key: keyof typeof authEn) => authEn[key];

describe('getOAuthErrorMessage', () => {
    test('returns no message when the provider did not return an error', () => {
        expect(getOAuthErrorMessage(null, ru)).toBeNull();
    });

    test('maps provider cancellation to safe feedback', () => {
        expect(getOAuthErrorMessage('access_denied', ru)).toContain('Вход отменён');
        expect(getOAuthErrorMessage('access_denied', en)).toContain('Sign-in was cancelled');
    });

    test('does not expose unknown raw provider errors', () => {
        expect(getOAuthErrorMessage('secret_provider_detail', ru)).not.toContain('secret_provider_detail');
        expect(getOAuthErrorMessage('secret_provider_detail', en)).toBe(authEn['auth.oauth.failed']);
    });
});
