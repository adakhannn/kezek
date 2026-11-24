import { createTranslate, translate } from '../../i18n/translate';
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

describe('a readable message is in the script of the screen language', () => {
    const en = createTranslate('en');
    const ky = createTranslate('ky');

    test('English: a client error thrown with t() text and an English 422 answer are shown', () => {
        const queueBlocks = translate('en', 'staff.selection.queueBlocks');
        expect(getErrorMessage(new Error(queueBlocks), 'Could not select the business.', en)).toBe(queueBlocks);

        const serverAnswer = Object.assign(new Error('This phone number is already in use.'), { status: 422 });
        expect(getErrorMessage(serverAnswer, undefined, en)).toBe('This phone number is already in use.');
    });

    test('English: a Cyrillic business name inside an English text keeps it English', () => {
        const named = translate('en', 'staff.selection.queueBlocksNamed', { business: 'Барбершоп Эркин' });
        expect(getErrorMessage(new Error(named), 'Could not select the business.', en)).toBe(named);
    });

    test('English: Russian, technical or empty text gives the English fallback', () => {
        expect(getErrorMessage(new Error('В бизнесе «Low Fade» есть неотправленные изменения смены.'), 'Fallback', en))
            .toBe('Fallback');
        expect(getErrorMessage(Object.assign(new Error('Этот номер телефона уже используется.'), { status: 422 }), undefined, en))
            .toBe(translate('en', 'cabinet.error.invalidInput'));
        expect(getErrorMessage(new TypeError("Cannot read properties of undefined (reading 'id')"), undefined, en))
            .toBe(translate('en', 'cabinet.error.default'));
        expect(getErrorMessage(new Error('   '), 'Fallback', en)).toBe('Fallback');
    });

    test('Kyrgyz and Russian still need Cyrillic', () => {
        const kyMessage = translate('ky', 'staff.selection.queueBlocks');
        expect(getErrorMessage(new Error(kyMessage), 'Запасной текст', ky)).toBe(kyMessage);
        expect(getErrorMessage(new Error('This phone number is already in use.'), 'Запасной текст', ky)).toBe('Запасной текст');
        expect(getErrorMessage(new Error('This phone number is already in use.'), 'Запасной текст')).toBe('Запасной текст');
    });
});
