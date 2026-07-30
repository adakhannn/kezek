import { buildGoogleOAuthRedirectUrl } from '@/lib/googleOAuthRedirect';

describe('buildGoogleOAuthRedirectUrl', () => {
    test('keeps a localhost sign-in flow on the same local origin', () => {
        expect(buildGoogleOAuthRedirectUrl(
            'http://localhost:3000',
            '/business/apply',
        )).toBe(
            'http://localhost:3000/auth/callback/google?next=%2Fbusiness%2Fapply',
        );
    });

    test('keeps a production sign-in flow on the production origin', () => {
        expect(buildGoogleOAuthRedirectUrl(
            'https://kezek.kg',
            '/cabinet/profile?tab=security',
        )).toBe(
            'https://kezek.kg/auth/callback/google?next=%2Fcabinet%2Fprofile%3Ftab%3Dsecurity',
        );
    });

    test('sanitizes an external return URL', () => {
        expect(buildGoogleOAuthRedirectUrl(
            'http://localhost:3000',
            'https://evil.example/phishing',
        )).toBe(
            'http://localhost:3000/auth/callback/google?next=%2F',
        );
    });
});
