/**
 * Утилиты для обработки ошибок
 */

export function getErrorMessage(error: unknown): string {
    if (error instanceof Error) {
        return error.message;
    }
    if (typeof error === 'string') {
        return error;
    }
    if (error && typeof error === 'object' && 'message' in error) {
        return String(error.message);
    }
    return 'Произошла неизвестная ошибка';
}

export function isNetworkError(error: unknown): boolean {
    if (error instanceof Error) {
        return (
            error.message.includes('network') ||
            error.message.includes('fetch') ||
            error.message.includes('Network request failed')
        );
    }
    return false;
}

export function isAuthError(error: unknown): boolean {
    if (error instanceof Error) {
        return (
            error.message.includes('auth') ||
            error.message.includes('unauthorized') ||
            error.message.includes('401')
        );
    }
    return false;
}

