import { getAuthReturnPath, sanitizeAuthReturnPath } from '@/lib/authReturnUrl';

describe('authReturnUrl', () => {
    test('keeps same-origin relative paths with query and hash', () => {
        expect(sanitizeAuthReturnPath('/b/manly/booking?service=1#time')).toBe(
            '/b/manly/booking?service=1#time',
        );
    });

    test('supports redirect and next aliases with redirect taking precedence', () => {
        expect(getAuthReturnPath(new URLSearchParams('next=%2Fb%2Fmanly%2Fbooking'))).toBe(
            '/b/manly/booking',
        );
        expect(
            getAuthReturnPath(
                new URLSearchParams('redirect=%2Fdashboard&next=%2Fb%2Fmanly%2Fbooking'),
            ),
        ).toBe('/dashboard');
    });

    test('rejects absolute, protocol-relative, and backslash URLs', () => {
        expect(sanitizeAuthReturnPath('https://evil.example/after-login')).toBe('/');
        expect(sanitizeAuthReturnPath('//evil.example/after-login')).toBe('/');
        expect(sanitizeAuthReturnPath('/\\evil.example\\after-login')).toBe('/');
    });
});
