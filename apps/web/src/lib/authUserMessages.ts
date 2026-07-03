export function toSafeAuthMessage(error: unknown): string {
    const raw = error instanceof Error ? error.message : String(error ?? '');
    const normalized = raw.toLowerCase();

    if (
        normalized.includes('auth session missing') ||
        normalized.includes('session missing') ||
        normalized.includes('not authenticated') ||
        normalized.includes('unauthenticated')
    ) {
        return 'Сессия не найдена или истекла. Запросите новую ссылку и попробуйте ещё раз.';
    }

    if (
        normalized.includes('token has expired') ||
        normalized.includes('expired') ||
        normalized.includes('invalid token') ||
        normalized.includes('invalid otp') ||
        normalized.includes('invalid login credentials')
    ) {
        return 'Код или ссылка недействительны либо истекли. Запросите новый код и попробуйте снова.';
    }

    if (
        normalized.includes('rate limit') ||
        normalized.includes('too many') ||
        normalized.includes('over_email_send_rate_limit')
    ) {
        return 'Слишком много попыток. Подождите немного и попробуйте снова.';
    }

    if (
        normalized.includes('password recovery requires an email') ||
        normalized.includes('email') && normalized.includes('required')
    ) {
        return 'Введите e-mail, чтобы получить ссылку восстановления.';
    }

    if (
        normalized.includes('unable to validate email') ||
        normalized.includes('invalid format') ||
        normalized.includes('invalid email') ||
        (normalized.includes('email') && normalized.includes('invalid'))
    ) {
        return 'Введите корректный e-mail адрес.';
    }

    if (
        normalized.includes('signups not allowed') ||
        normalized.includes('user not found') ||
        normalized.includes('not found')
    ) {
        return 'Если аккаунт существует, мы отправим код или ссылку. Проверьте адрес и попробуйте ещё раз.';
    }

    if (normalized.includes('password') && normalized.includes('characters')) {
        return 'Пароль слишком короткий. Используйте не менее 8 символов.';
    }

    return 'Не удалось выполнить действие. Проверьте данные и попробуйте ещё раз.';
}
