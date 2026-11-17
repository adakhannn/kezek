import { runStaffDeleteService, STAFF_HAS_HISTORY_MESSAGE } from '@/lib/staffDeleteService';

function adminReturning(error: { message?: string; code?: string } | null) {
    return { rpc: jest.fn().mockResolvedValue({ error }) };
}

describe('runStaffDeleteService (API-05)', () => {
    test('deletes through the single database command', async () => {
        const admin = adminReturning(null);

        await expect(runStaffDeleteService({ admin, bizId: 'biz-1', staffId: 'staff-1' })).resolves.toEqual({ ok: true });
        expect(admin.rpc).toHaveBeenCalledTimes(1);
        expect(admin.rpc).toHaveBeenCalledWith('delete_staff_without_history', { p_biz_id: 'biz-1', p_staff_id: 'staff-1' });
    });

    test('a master with history is dismissed instead of deleted', async () => {
        const result = await runStaffDeleteService({ admin: adminReturning({ message: 'STAFF_HAS_HISTORY', code: 'P0001' }), bizId: 'biz-1', staffId: 'staff-1' });

        expect(result).toEqual({ ok: false, error: 'conflict', message: STAFF_HAS_HISTORY_MESSAGE, status: 409 });
    });

    test('a master of another business is not found', async () => {
        const result = await runStaffDeleteService({ admin: adminReturning({ message: 'STAFF_NOT_FOUND', code: 'P0002' }), bizId: 'biz-1', staffId: 'staff-1' });

        expect(result).toMatchObject({ ok: false, error: 'not_found', status: 404 });
    });

    test('other database errors are not passed to the client', async () => {
        const result = await runStaffDeleteService({
            admin: adminReturning({ message: 'update or delete on table "staff" violates foreign key constraint', code: '23503' }),
            bizId: 'biz-1',
            staffId: 'staff-1',
        });

        expect(result).toEqual({ ok: false, error: 'internal', message: 'Не удалось удалить сотрудника', status: 500 });
    });
});
