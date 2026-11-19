/** The keys of the safe auth messages (auth dictionaries). */
type AuthMessageKey =
    | 'auth.error.sessionMissing'
    | 'auth.error.codeInvalid'
    | 'auth.error.rateLimited'
    | 'auth.error.emailRequired'
    | 'auth.error.emailInvalid'
    | 'auth.error.accountMaybeMissing'
    | 'auth.error.passwordTooShort'
    | 'auth.error.generic';

/** A provider error as a safe message in the UI language; provider text never reaches the screen (FE-10). */
export function toSafeAuthMessage(error: unknown, t: (key: AuthMessageKey, fallback: string) => string): string {
    const raw = error instanceof Error ? error.message : String(error ?? '');
    const normalized = raw.toLowerCase();

    if (
        normalized.includes('auth session missing') ||
        normalized.includes('session missing') ||
        normalized.includes('not authenticated') ||
        normalized.includes('unauthenticated')
    ) {
        return t('auth.error.sessionMissing', 'Сессия не найдена или истекла. Запросите новую ссылку и попробуйте ещё раз.');
    }

    if (
        normalized.includes('token has expired') ||
        normalized.includes('expired') ||
        normalized.includes('invalid token') ||
        normalized.includes('invalid otp') ||
        normalized.includes('invalid login credentials')
    ) {
        return t('auth.error.codeInvalid', 'Код или ссылка недействительны либо истекли. Запросите новый код и попробуйте снова.');
    }

    if (
        normalized.includes('rate limit') ||
        normalized.includes('too many') ||
        normalized.includes('over_email_send_rate_limit')
    ) {
        return t('auth.error.rateLimited', 'Слишком много попыток. Подождите немного и попробуйте снова.');
    }

    if (
        normalized.includes('password recovery requires an email') ||
        normalized.includes('email') && normalized.includes('required')
    ) {
        return t('auth.error.emailRequired', 'Введите e-mail, чтобы получить ссылку восстановления.');
    }

    if (
        normalized.includes('unable to validate email') ||
        normalized.includes('invalid format') ||
        normalized.includes('invalid email') ||
        (normalized.includes('email') && normalized.includes('invalid'))
    ) {
        return t('auth.error.emailInvalid', 'Введите корректный e-mail адрес.');
    }

    if (
        normalized.includes('signups not allowed') ||
        normalized.includes('user not found') ||
        normalized.includes('not found')
    ) {
        return t('auth.error.accountMaybeMissing', 'Если аккаунт существует, мы отправим код или ссылку. Проверьте адрес и попробуйте ещё раз.');
    }

    if (normalized.includes('password') && normalized.includes('characters')) {
        return t('auth.error.passwordTooShort', 'Пароль слишком короткий. Используйте не менее 8 символов.');
    }

    return t('auth.error.generic', 'Не удалось выполнить действие. Проверьте данные и попробуйте ещё раз.');
}
