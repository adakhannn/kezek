import type { SupabaseClient } from '@supabase/supabase-js';

import {
    SupabaseBookingRepository,
    SupabaseBranchRepository,
    SupabaseStaffRepository,
    SupabasePromotionRepository,
} from '@/lib/repositories';
import type { BookingStatus } from '@core-domain/booking';

function createMockSupabase() {
    const fromMock = jest.fn();

    const supabase = {
        from: fromMock,
    } as unknown as SupabaseClient;

    return { supabase, fromMock };
}

describe('SupabaseBookingRepository', () => {
    it('findById возвращает запись бронирования', async () => {
        const { supabase, fromMock } = createMockSupabase();
        const selectMock = jest.fn().mockReturnThis();
        const eqMock = jest.fn().mockReturnThis();
        const maybeSingleMock = jest.fn().mockResolvedValue({
            data: {
                id: 'b1',
                biz_id: 'biz1',
                branch_id: 'br1',
                service_id: 'srv1',
                staff_id: 'st1',
                status: 'confirmed' as BookingStatus,
                promotion_applied: null,
            },
            error: null,
        });

        (fromMock as unknown as jest.Mock).mockReturnValue({
            select: selectMock,
            eq: eqMock,
            maybeSingle: maybeSingleMock,
        });

        const repo = new SupabaseBookingRepository(supabase);
        const result = await repo.findById('b1');

        expect(fromMock).toHaveBeenCalledWith('bookings');
        expect(selectMock).toHaveBeenCalled();
        expect(eqMock).toHaveBeenCalledWith('id', 'b1');
        expect(result).not.toBeNull();
        expect(result?.id).toBe('b1');
    });

    it('updateStatus обновляет статус без ошибок', async () => {
        const { supabase, fromMock } = createMockSupabase();
        const updateMock = jest.fn().mockReturnThis();
        const eqMock = jest.fn().mockResolvedValue({ error: null });

        (fromMock as unknown as jest.Mock).mockReturnValue({
            update: updateMock,
            eq: eqMock,
        });

        const repo = new SupabaseBookingRepository(supabase);
        await expect(
            repo.updateStatus({ bookingId: 'b1', newStatus: 'paid' }),
        ).resolves.toBeUndefined();

        expect(fromMock).toHaveBeenCalledWith('bookings');
        expect(updateMock).toHaveBeenCalledWith({ status: 'paid' });
        expect(eqMock).toHaveBeenCalledWith('id', 'b1');
    });
});

describe('SupabaseBranchRepository', () => {
    it('findActiveById возвращает активный филиал', async () => {
        const { supabase, fromMock } = createMockSupabase();
        const selectMock = jest.fn().mockReturnThis();
        const eqMock = jest.fn().mockReturnThis();
        const maybeSingleMock = jest.fn().mockResolvedValue({
            data: { id: 'br1' },
            error: null,
        });

        (fromMock as unknown as jest.Mock).mockReturnValue({
            select: selectMock,
            eq: eqMock,
            maybeSingle: maybeSingleMock,
        });

        const repo = new SupabaseBranchRepository(supabase);
        const result = await repo.findActiveById({
            bizId: 'biz1',
            branchId: 'br1',
        });

        expect(fromMock).toHaveBeenCalledWith('branches');
        expect(eqMock).toHaveBeenCalledWith('id', 'br1');
        expect(result).toEqual({ id: 'br1' });
    });

    it('findFirstActiveByBizId возвращает первый активный филиал', async () => {
        const { supabase, fromMock } = createMockSupabase();
        const selectMock = jest.fn().mockReturnThis();
        const eqMock = jest.fn().mockReturnThis();
        const orderMock = jest.fn().mockReturnThis();
        const limitMock = jest.fn().mockReturnThis();
        const maybeSingleMock = jest.fn().mockResolvedValue({
            data: { id: 'br2' },
            error: null,
        });

        (fromMock as unknown as jest.Mock).mockReturnValue({
            select: selectMock,
            eq: eqMock,
            order: orderMock,
            limit: limitMock,
            maybeSingle: maybeSingleMock,
        });

        const repo = new SupabaseBranchRepository(supabase);
        const result = await repo.findFirstActiveByBizId('biz1');

        expect(fromMock).toHaveBeenCalledWith('branches');
        expect(eqMock).toHaveBeenCalledWith('biz_id', 'biz1');
        expect(result).toEqual({ id: 'br2' });
    });
});

describe('SupabaseStaffRepository', () => {
    it('existsActiveStaff возвращает true при наличии записи', async () => {
        const { supabase, fromMock } = createMockSupabase();
        const selectMock = jest.fn().mockReturnThis();
        const eqMock = jest.fn().mockReturnThis();
        const selectResultMock = jest.fn().mockResolvedValue({
            data: null,
            error: null,
            count: 1,
        });

        (fromMock as unknown as jest.Mock).mockReturnValue({
            select: selectMock,
            eq: eqMock,
        });

        (selectMock as unknown as jest.Mock).mockReturnValue({
            eq: eqMock,
        });

        (eqMock as unknown as jest.Mock).mockReturnValue({
            eq: eqMock,
        });

        (eqMock as unknown as jest.Mock).mockReturnValueOnce({
            eq: eqMock,
        }).mockReturnValueOnce({
            eq: eqMock,
        }).mockReturnValueOnce({
            // последний вызов возвращает промис результата
            then: selectResultMock.then.bind(selectResultMock),
        } as unknown as Promise<unknown>);

        const repo = new SupabaseStaffRepository(supabase);
        const exists = await repo.existsActiveStaff({
            bizId: 'biz1',
            staffId: 'st1',
        });

        expect(fromMock).toHaveBeenCalledWith('staff');
        expect(exists).toBe(true);
    });
});

describe('SupabasePromotionRepository', () => {
    it('getUsageCount возвращает usage_count или 0', async () => {
        const { supabase, fromMock } = createMockSupabase();
        const selectMock = jest.fn().mockReturnThis();
        const eqMock = jest.fn().mockReturnThis();
        const maybeSingleMock = jest.fn().mockResolvedValue({
            data: { usage_count: 5 },
            error: null,
        });

        (fromMock as unknown as jest.Mock).mockReturnValue({
            select: selectMock,
            eq: eqMock,
            maybeSingle: maybeSingleMock,
        });

        const repo = new SupabasePromotionRepository(supabase);
        const count = await repo.getUsageCount('promo1');

        expect(fromMock).toHaveBeenCalledWith('promotion_usage_stats');
        expect(eqMock).toHaveBeenCalledWith('promotion_id', 'promo1');
        expect(count).toBe(5);
    });
});

