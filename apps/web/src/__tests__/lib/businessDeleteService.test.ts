import { BUSINESS_HAS_HISTORY_MESSAGE, runBusinessDelete } from '@/lib/businessDeleteService';

jest.mock('@/lib/log', () => ({ logError: jest.fn() }));

describe('businessDeleteService (DB-14)', () => {
    const run = (error: { message: string; code?: string } | null) => {
        const admin = { rpc: jest.fn().mockResolvedValue({ error }) };
        return { admin, result: runBusinessDelete({ admin, bizId: 'biz-1' }) };
    };

    test('one database command deletes a business without history', async () => {
        const { admin, result } = run(null);
        await expect(result).resolves.toEqual({ ok: true });
        expect(admin.rpc).toHaveBeenCalledWith('delete_business_without_history', { p_biz_id: 'biz-1' });
    });

    test('history is refused with an explanation', async () => {
        await expect(run({ message: 'BUSINESS_HAS_HISTORY' }).result).resolves.toEqual({ ok: false, error: 'conflict', message: BUSINESS_HAS_HISTORY_MESSAGE, status: 409 });
        await expect(run({ message: 'BUSINESS_NOT_FOUND' }).result).resolves.toEqual({ ok: false, error: 'not_found', message: 'Бизнес не найден', status: 404 });
    });

    test('an unexpected failure is a 500 without database text', async () => {
        await expect(run({ message: 'could not serialize access', code: '40001' }).result).resolves.toEqual({ ok: false, error: 'internal', message: 'Не удалось удалить бизнес', status: 500 });
    });
});
