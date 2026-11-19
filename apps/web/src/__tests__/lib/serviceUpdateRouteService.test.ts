import { runServiceUpdateFlow } from '@/lib/serviceUpdateRouteService';

jest.mock('@/lib/log', () => ({ logError: jest.fn() }));

const body = {
    name_ru: ' Massage ',
    name_ky: ' ',
    name_en: 'Massage',
    duration_min: 60,
    price_from: 1000,
    price_to: 1500,
    active: true,
    branch_ids: ['branch-1', 'branch-2'],
};

function adminWith(result: { data?: unknown; error: { code?: string; message: string; details?: string | null } | null }) {
    const rpc = jest.fn().mockResolvedValue({ data: result.data ?? null, error: result.error });
    // ARCH-07: every write goes through the one command; a table call means a step outside its transaction.
    return { rpc, from: jest.fn(() => { throw new Error('no table access outside update_service_group'); }) };
}

describe('serviceUpdateRouteService', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    test('saves the whole group with one command', async () => {
        const admin = adminWith({ data: { updated: 1, added: 1, deleted: 1, archived: 0 }, error: null });

        const result = await runServiceUpdateFlow({ admin: admin as never, bizId: 'biz-id', serviceId: 'service-id', body });

        expect(result).toEqual({ ok: true });
        expect(admin.rpc).toHaveBeenCalledTimes(1);
        expect(admin.rpc).toHaveBeenCalledWith('update_service_group', {
            p_biz_id: 'biz-id',
            p_service_id: 'service-id',
            p_branch_ids: ['branch-1', 'branch-2'],
            p_name_ru: 'Massage',
            p_name_ky: null,
            p_name_en: 'Massage',
            p_duration_min: 60,
            p_price_from: 1000,
            p_price_to: 1500,
            p_active: true,
        });
    });

    test('falls back to branch_id when branch_ids is absent', async () => {
        const admin = adminWith({ error: null });
        const { branch_ids: _omit, ...rest } = body;

        await runServiceUpdateFlow({ admin: admin as never, bizId: 'biz-id', serviceId: 'service-id', body: { ...rest, branch_id: 'branch-9' } });

        expect(admin.rpc).toHaveBeenCalledWith('update_service_group', expect.objectContaining({ p_branch_ids: ['branch-9'] }));
    });

    test.each([
        ['a negative price', { price_from: 0, price_to: -300 }, 'Цена не может быть отрицательной'],
        ['a minimum above the maximum', { price_from: 500, price_to: 0 }, 'Минимальная цена не может быть больше максимальной'],
        ['a fractional duration', { duration_min: 1.5 }, 'Длительность должна быть больше 0'],
        ['an empty name', { name_ru: '  ' }, 'Имя обязательно'],
        ['no branch', { branch_ids: [] }, 'Необходимо указать хотя бы один филиал'],
    ])('rejects %s before calling the command', async (_label, change, message) => {
        const admin = adminWith({ error: null });

        const result = await runServiceUpdateFlow({ admin: admin as never, bizId: 'biz-id', serviceId: 'service-id', body: { ...body, ...change } });

        expect(result).toEqual({ ok: false, error: 'validation', message, status: 400 });
        expect(admin.rpc).not.toHaveBeenCalled();
    });

    test('a removed branch with future bookings is a conflict, and nothing is saved', async () => {
        const admin = adminWith({ error: { code: 'P0001', message: 'SERVICE_BRANCH_HAS_FUTURE_BOOKINGS', details: 'Branch 2, Branch 3' } });

        const result = await runServiceUpdateFlow({ admin: admin as never, bizId: 'biz-id', serviceId: 'service-id', body });

        expect(result).toMatchObject({ ok: false, error: 'conflict', status: 409, details: { branches: ['Branch 2', 'Branch 3'] } });
        expect((result as { message: string }).message).toContain('филиалов "Branch 2, Branch 3"');
        expect((result as { message: string }).message).toContain('Изменения не сохранены');
    });

    test.each([
        ['SERVICE_FORBIDDEN', '42501', null, { error: 'forbidden', status: 403, message: 'Услуга не принадлежит этому бизнесу' }],
        ['SERVICE_BRANCH_FORBIDDEN', '42501', 'b-1,b-2', { error: 'forbidden', status: 403, details: { missing: ['b-1', 'b-2'] } }],
        ['new row violates check constraint "services_price_range_check"', '23514', null, { error: 'validation', status: 400 }],
        ['canceling statement due to lock timeout', '55P03', null, { error: 'service_unavailable', status: 503 }],
        ['deadlock detected', '40P01', null, { error: 'internal', status: 500 }],
    ])('maps %s', async (message, code, details, expected) => {
        const admin = adminWith({ error: { code, message, details } });

        const result = await runServiceUpdateFlow({ admin: admin as never, bizId: 'biz-id', serviceId: 'service-id', body });

        expect(result).toMatchObject({ ok: false, ...expected });
    });
});
