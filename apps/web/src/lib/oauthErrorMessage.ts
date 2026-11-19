/** The keys of the sign-in error messages (auth dictionaries). */
type OAuthErrorMessageKey = 'auth.oauth.cancelled' | 'auth.oauth.failed';

/** The provider's error code as a message in the UI language; the raw code is never shown (FE-10). */
export function getOAuthErrorMessage(
    errorCode: string | null,
    t: (key: OAuthErrorMessageKey, fallback: string) => string,
): string | null {
    if (!errorCode) return null;

    const normalized = errorCode.trim().toLowerCase();
    if (normalized === 'access_denied' || normalized === 'user_cancelled') {
        return t('auth.oauth.cancelled', 'Вход отменён. Попробуйте снова или выберите другой способ входа.');
    }

    return t('auth.oauth.failed', 'Не удалось завершить вход. Попробуйте снова или выберите другой способ входа.');
}
