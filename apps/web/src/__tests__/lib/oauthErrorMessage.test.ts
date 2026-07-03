import { getOAuthErrorMessage } from '@/lib/oauthErrorMessage';

describe('getOAuthErrorMessage', () => {
    test('returns no message when the provider did not return an error', () => {
        expect(getOAuthErrorMessage(null)).toBeNull();
    });

    test('maps provider cancellation to safe feedback', () => {
        expect(getOAuthErrorMessage('access_denied')).toContain('Вход отменён');
    });

    test('does not expose unknown raw provider errors', () => {
        expect(getOAuthErrorMessage('secret_provider_detail')).not.toContain('secret_provider_detail');
    });
});
