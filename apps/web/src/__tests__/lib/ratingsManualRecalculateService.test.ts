import { runRatingsManualRecalculate } from '@/lib/ratingsManualRecalculateService';

describe('ratingsManualRecalculateService', () => {
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
