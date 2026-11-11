import { runRatingsManualRecalculate } from '@/lib/ratingsManualRecalculateService';

describe('ratingsManualRecalculateService', () => {
    test.each([0, 1])('stops on a resolved RPC error at step %s and logs failure', async (failedStep) => {
        const rpc = jest.fn();
        if (failedStep === 1) rpc.mockResolvedValueOnce({ error: null });
        rpc.mockResolvedValueOnce({ error: { message: 'database unavailable' } });
        const insert = jest.fn().mockResolvedValue({ error: null });
        const result = await runRatingsManualRecalculate({
            admin: { rpc, from: jest.fn().mockReturnValue({ insert }) }, userId: 'user-1',
            body: { entity_type: 'staff', entity_id: 'staff-1', date_from: '2026-03-01', date_to: '2026-03-10' },
        });
        expect(result).toMatchObject({ ok: false, status: 500 });
        expect(rpc).toHaveBeenCalledTimes(failedStep + 1);
        expect(insert).toHaveBeenCalledWith(expect.objectContaining({ status: 'error', error_message: 'database unavailable' }));
    });

    test.each([
        { date_from: 'invalid', date_to: '2026-03-10' },
        { date_from: '2026-02-30', date_to: '2026-03-10' },
        { date_from: '2026-03-10', date_to: '2026-03-01' },
        { date_from: '2026-03-01' },
        { date_to: '2026-03-01' },
    ])('rejects invalid range without RPC or log writes: %j', async (range) => {
        const admin = { rpc: jest.fn(), from: jest.fn() };
        expect(await runRatingsManualRecalculate({ admin, userId: 'user-1', body: {
            entity_type: 'staff', entity_id: 'staff-1', ...range,
        } })).toMatchObject({ ok: false, status: 400 });
        expect(admin.rpc).not.toHaveBeenCalled();
        expect(admin.from).not.toHaveBeenCalled();
    });
    test('returns bad_request when entity params are missing', async () => {
        const result = await runRatingsManualRecalculate({
            admin: {
                rpc: jest.fn(),
                from: jest.fn(),
            } as never,
            userId: 'user-1',
            body: {},
        });

        expect(result).toEqual({
            ok: false,
            error: 'bad_request',
            message: 'entity_type и entity_id обязательны',
            status: 400,
        });
    });

    test('recalculates metrics range and logs manual run', async () => {
        const rpc = jest.fn().mockResolvedValue({});
        const insert = jest.fn().mockResolvedValue({});

        const result = await runRatingsManualRecalculate({
            admin: {
                rpc,
                from: jest.fn().mockReturnValue({ insert }),
            } as never,
            userId: 'user-1',
            body: {
                entity_type: 'staff',
                entity_id: 'staff-1',
                date_from: '2026-03-01',
                date_to: '2026-03-10',
            },
        });

        expect(rpc).toHaveBeenNthCalledWith(1, 'recalculate_ratings_for_date_range', {
            p_start_date: '2026-03-01',
            p_end_date: '2026-03-10',
        });
        expect(rpc).toHaveBeenNthCalledWith(2, 'calculate_staff_rating', {
            p_staff_id: 'staff-1',
        });
        expect(insert).toHaveBeenCalled();
        expect(result).toEqual({
            ok: true,
            data: {
                ok: true,
                entity_type: 'staff',
                entity_id: 'staff-1',
                action: 'recalculate_metrics',
            },
        });
    });

    test('returns internal error when recalculation rpc fails', async () => {
        const insert = jest.fn().mockResolvedValue({});

        const result = await runRatingsManualRecalculate({
            admin: {
                rpc: jest.fn().mockRejectedValue(new Error('rpc failed')),
                from: jest.fn().mockReturnValue({ insert }),
            } as never,
            userId: 'user-1',
            body: {
                entity_type: 'biz',
                entity_id: 'biz-1',
            },
        });

        expect(insert).toHaveBeenCalled();
        expect(result).toEqual({
            ok: false,
            error: 'internal',
            message: 'rpc failed',
            status: 500,
        });
    });
});
