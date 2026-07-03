export function getOAuthErrorMessage(errorCode: string | null): string | null {
    if (!errorCode) return null;

    const normalized = errorCode.trim().toLowerCase();
    if (normalized === 'access_denied' || normalized === 'user_cancelled') {
        return 'Вход отменён. Попробуйте снова или выберите другой способ входа.';
    }

    return 'Не удалось завершить вход. Попробуйте снова или выберите другой способ входа.';
}
