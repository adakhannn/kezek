import { financeCommandFailure } from '@/lib/staffShift/financeCommand';

describe('financeCommandFailure', () => {
    test.each(['55P03', '57014'])('a shift lock or statement timeout (%s) is a retryable 503', (code) => {
        expect(financeCommandFailure({ code, message: 'canceling statement due to lock timeout' })).toEqual({
            ok: false,
            statusCode: 503,
            errorType: 'service_unavailable',
            message: 'Смена сейчас занята другой операцией. Изменения не сохранены — повторите через несколько секунд.',
        });
    });

    test('known command errors keep their status; anything else is an internal error', () => {
        expect(financeCommandFailure({ code: '42501' })).toMatchObject({ statusCode: 403, errorType: 'forbidden' });
        expect(financeCommandFailure({ code: '40001' })).toMatchObject({ statusCode: 409, errorType: 'validation' });
        for (const code of ['22023', '22P02', '23514']) {
            expect(financeCommandFailure({ code })).toMatchObject({ statusCode: 400, errorType: 'validation' });
        }
        expect(financeCommandFailure({ code: 'XX000', message: 'boom' })).toMatchObject({ statusCode: 500, errorType: 'internal' });
        expect(financeCommandFailure({ message: 'Invalid save response' })).toMatchObject({ statusCode: 500 });
    });
});
