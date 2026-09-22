type AuthErrorLike = {
    code?: unknown;
    message?: unknown;
    name?: unknown;
};

export function isAuthSessionMissingError(error: unknown): boolean {
    return Boolean(
        error &&
            typeof error === 'object' &&
            (error as AuthErrorLike).name === 'AuthSessionMissingError',
    );
}

export function isInvalidRefreshTokenError(error: unknown): boolean {
    if (!error || typeof error !== 'object') return false;

    const { code, message } = error as AuthErrorLike;
    return (
        code === 'refresh_token_not_found' ||
        code === 'refresh_token_already_used' ||
        (typeof message === 'string' && /invalid refresh token|refresh token not found/i.test(message))
    );
}

export function isSupabaseAuthCookie(name: string): boolean {
    return /^sb-.+-auth-token(?:-code-verifier)?(?:\.\d+)?$/.test(name);
}
