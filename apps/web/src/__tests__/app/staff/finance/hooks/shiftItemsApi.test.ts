import {
    getShiftItemsJsonErrorMessage,
    getShiftItemsResponseErrorMessage,
    getShiftItemsThrownErrorMessage,
    shouldRestoreShiftItemsFromError,
} from '@/app/staff/finance/hooks/shiftItemsApi';

describe('shiftItemsApi', () => {
    describe('getShiftItemsResponseErrorMessage', () => {
        it('maps forbidden add response to operation-specific message', async () => {
            const response = new Response(JSON.stringify({ error: 'ignored' }), { status: 403 });

            await expect(getShiftItemsResponseErrorMessage(response, 'add')).resolves.toBe(
                'У вас нет прав для добавления клиентов.'
            );
        });

        it('preserves server payload for 400 responses', async () => {
            const response = new Response(JSON.stringify({ error: 'Проверьте сумму услуги' }), {
                status: 400,
            });

            await expect(getShiftItemsResponseErrorMessage(response, 'save')).resolves.toBe(
                'Проверьте сумму услуги'
            );
        });
    });

    describe('getShiftItemsJsonErrorMessage', () => {
        it('extracts json error field', () => {
            expect(getShiftItemsJsonErrorMessage({ error: 'Смена уже закрыта' }, 'delete')).toBe(
                'Смена уже закрыта'
            );
        });

        it('falls back to operation default when json does not contain error', () => {
            expect(getShiftItemsJsonErrorMessage({}, 'save')).toBe('Не удалось сохранить изменения');
        });
    });

    describe('getShiftItemsThrownErrorMessage', () => {
        it('uses rate limit message from error', () => {
            const error = new Error('Слишком много запросов');
            error.name = 'RateLimitError';

            expect(getShiftItemsThrownErrorMessage(error, 'add')).toBe('Слишком много запросов');
        });

        it('falls back to operation default for unknown thrown values', () => {
            expect(getShiftItemsThrownErrorMessage({ foo: 'bar' }, 'delete')).toBe(
                'Не удалось удалить клиента'
            );
        });
    });

    describe('shouldRestoreShiftItemsFromError', () => {
        it('returns true for closed or missing shift errors', () => {
            expect(shouldRestoreShiftItemsFromError('Смена не найдена. Возможно, смена была закрыта.')).toBe(true);
            expect(shouldRestoreShiftItemsFromError('Нет открытой смены для сохранения')).toBe(true);
        });

        it('returns false for generic validation errors', () => {
            expect(shouldRestoreShiftItemsFromError('Проверьте введенную информацию')).toBe(false);
        });
    });
});
