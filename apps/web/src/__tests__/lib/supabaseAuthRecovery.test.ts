import {
    isAuthSessionMissingError,
    isInvalidRefreshTokenError,
    isSupabaseAuthCookie,
} from '@/lib/supabaseAuthRecovery';

describe('Supabase auth recovery', () => {
    it('recognizes the normal signed-out state', () => {
        expect(isAuthSessionMissingError({ name: 'AuthSessionMissingError' })).toBe(true);
        expect(isAuthSessionMissingError({ name: 'AuthApiError' })).toBe(false);
    });

    it('recognizes invalid refresh-token errors', () => {
        expect(isInvalidRefreshTokenError({ code: 'refresh_token_not_found' })).toBe(true);
        expect(isInvalidRefreshTokenError({ message: 'Invalid Refresh Token: Refresh Token Not Found' })).toBe(true);
        expect(isInvalidRefreshTokenError({ code: 'unexpected_failure' })).toBe(false);
    });

    it('only selects Supabase session cookies for cleanup', () => {
        expect(isSupabaseAuthCookie('sb-project-auth-token')).toBe(true);
        expect(isSupabaseAuthCookie('sb-project-auth-token.0')).toBe(true);
        expect(isSupabaseAuthCookie('sb-project-auth-token-code-verifier')).toBe(true);
        expect(isSupabaseAuthCookie('NEXT_LOCALE')).toBe(false);
        expect(isSupabaseAuthCookie('other-session')).toBe(false);
    });
});
