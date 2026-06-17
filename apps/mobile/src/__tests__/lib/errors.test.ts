import { getErrorMessage, isAuthError, isNetworkError } from '../../lib/errors';

describe('user-facing error mapping', () => {
    test.each([
        [
            new TypeError('Network request failed'),
            'Нет подключения к интернету. Проверьте соединение и попробуйте снова.',
        ],
        [
            Object.assign(new Error('HTTP 500'), { status: 500 }),
            'Сервис временно недоступен. Попробуйте позже.',
        ],
        [
            Object.assign(new Error('Unauthorized'), { status: 401 }),
            'Сессия истекла. Войдите в аккаунт снова.',
        ],
        [
            Object.assign(new Error('Forbidden'), { status: 403 }),
            'У вас недостаточно прав для этого действия.',
        ],
        [
            Object.assign(new Error('booking not found'), { status: 404 }),
            'Запрошенные данные не найдены.',
        ],
        [
            Object.assign(new Error('Server validation failed'), { status: 422 }),
            'Проверьте введенные данные и попробуйте снова.',
        ],
    ])('maps technical error %# to understandable copy', (error, expected) => {
        expect(getErrorMessage(error)).toBe(expected);
    });

    test('preserves a safe localized server message', () => {
        const error = Object.assign(new Error('Этот номер телефона уже используется.'), {
            status: 422,
        });

        expect(getErrorMessage(error)).toBe('Этот номер телефона уже используется.');
    });

    test('uses an action-specific fallback for an unknown English error', () => {
        expect(
            getErrorMessage(new Error('Internal resolver exploded'), 'Не удалось сохранить изменения.'),
        ).toBe('Не удалось сохранить изменения.');
    });

    test('detects network and authorization errors consistently', () => {
        expect(isNetworkError(new Error('Network request failed'))).toBe(true);
        expect(isAuthError(Object.assign(new Error('JWT expired'), { status: 401 }))).toBe(true);
        expect(isAuthError(new Error('OAuth provider unavailable'))).toBe(false);
    });
});
