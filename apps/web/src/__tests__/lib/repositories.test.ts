import type { BookingStatus } from '@core-domain/booking';
import type { SupabaseClient } from '@supabase/supabase-js';

import {
    SupabaseBookingRepository,
    SupabaseBranchRepository,
    SupabasePromotionRepository,
    SupabaseStaffRepository,
} from '@/lib/repositories';

function createMockSupabase() {
    const fromMock = jest.fn();

    return {
        supabase: {
            from: fromMock,
        } as unknown as SupabaseClient,
        fromMock,
    };
}

function createQueryBuilder() {
    const query = {
        select: jest.fn(),
        eq: jest.fn(),
        maybeSingle: jest.fn(),
        order: jest.fn(),
        limit: jest.fn(),
        update: jest.fn(),
    };

    query.select.mockReturnValue(query);
    query.eq.mockReturnValue(query);
    query.order.mockReturnValue(query);
    query.limit.mockReturnValue(query);
    query.update.mockReturnValue(query);

    return query;
}

describe('SupabaseBookingRepository', () => {
    it('returns booking row from findById', async () => {
        const { supabase, fromMock } = createMockSupabase();
        const query = createQueryBuilder();
        query.maybeSingle.mockResolvedValue({
            data: {
                id: 'b1',
                biz_id: 'biz1',
                branch_id: 'br1',
                service_id: 'srv1',
                staff_id: 'st1',
                start_at: '2026-03-26T10:00:00Z',
                status: 'confirmed' as BookingStatus,
                promotion_applied: null,
            },
            error: null,
        });
        fromMock.mockReturnValue(query);

        const repo = new SupabaseBookingRepository(supabase);

        await expect(repo.findById('b1')).resolves.toMatchObject({ id: 'b1' });
        expect(fromMock).toHaveBeenCalledWith('bookings');
        expect(query.eq).toHaveBeenCalledWith('id', 'b1');
    });

    it('returns null when booking is not found', async () => {
        const { supabase, fromMock } = createMockSupabase();
        const query = createQueryBuilder();
        query.maybeSingle.mockResolvedValue({ data: null, error: null });
        fromMock.mockReturnValue(query);

        const repo = new SupabaseBookingRepository(supabase);

        await expect(repo.findById('missing-booking')).resolves.toBeNull();
    });

    it('rethrows findById query errors', async () => {
        const { supabase, fromMock } = createMockSupabase();
        const query = createQueryBuilder();
        const error = new Error('booking lookup failed');
        query.maybeSingle.mockResolvedValue({ data: null, error });
        fromMock.mockReturnValue(query);

        const repo = new SupabaseBookingRepository(supabase);

        await expect(repo.findById('b1')).rejects.toThrow('booking lookup failed');
    });

    it('updates booking status', async () => {
        const { supabase, fromMock } = createMockSupabase();
        const query = createQueryBuilder();
        query.eq.mockResolvedValue({ error: null });
        fromMock.mockReturnValue(query);

        const repo = new SupabaseBookingRepository(supabase);

        await expect(
            repo.updateStatus({ bookingId: 'b1', newStatus: 'paid' }),
        ).resolves.toBeUndefined();
        expect(query.update).toHaveBeenCalledWith({ status: 'paid' });
        expect(query.eq).toHaveBeenCalledWith('id', 'b1');
    });

    it('rethrows updateStatus errors', async () => {
        const { supabase, fromMock } = createMockSupabase();
        const query = createQueryBuilder();
        const error = new Error('update failed');
        query.eq.mockResolvedValue({ error });
        fromMock.mockReturnValue(query);

        const repo = new SupabaseBookingRepository(supabase);

        await expect(
            repo.updateStatus({ bookingId: 'b1', newStatus: 'cancelled' }),
        ).rejects.toThrow('update failed');
    });
});

describe('SupabaseBranchRepository', () => {
    it('returns active branch by id', async () => {
        const { supabase, fromMock } = createMockSupabase();
        const query = createQueryBuilder();
        query.maybeSingle.mockResolvedValue({ data: { id: 'br1' }, error: null });
        fromMock.mockReturnValue(query);

        const repo = new SupabaseBranchRepository(supabase);

        await expect(repo.findActiveById({ bizId: 'biz1', branchId: 'br1' })).resolves.toEqual({
            id: 'br1',
        });
        expect(query.eq).toHaveBeenCalledWith('id', 'br1');
        expect(query.eq).toHaveBeenCalledWith('biz_id', 'biz1');
        expect(query.eq).toHaveBeenCalledWith('is_active', true);
    });

    it('returns null when active branch does not exist', async () => {
        const { supabase, fromMock } = createMockSupabase();
        const query = createQueryBuilder();
        query.maybeSingle.mockResolvedValue({ data: null, error: null });
        fromMock.mockReturnValue(query);

        const repo = new SupabaseBranchRepository(supabase);

        await expect(repo.findActiveById({ bizId: 'biz1', branchId: 'missing' })).resolves.toBeNull();
    });

    it('rethrows branch lookup errors', async () => {
        const { supabase, fromMock } = createMockSupabase();
        const query = createQueryBuilder();
        const error = new Error('branch lookup failed');
        query.maybeSingle.mockResolvedValue({ data: null, error });
        fromMock.mockReturnValue(query);

        const repo = new SupabaseBranchRepository(supabase);

        await expect(repo.findActiveById({ bizId: 'biz1', branchId: 'br1' })).rejects.toThrow(
            'branch lookup failed',
        );
    });

    it('returns first active branch by business id', async () => {
        const { supabase, fromMock } = createMockSupabase();
        const query = createQueryBuilder();
        query.maybeSingle.mockResolvedValue({ data: { id: 'br2' }, error: null });
        fromMock.mockReturnValue(query);

        const repo = new SupabaseBranchRepository(supabase);

        await expect(repo.findFirstActiveByBizId('biz1')).resolves.toEqual({ id: 'br2' });
        expect(query.order).toHaveBeenCalledWith('created_at', { ascending: true });
        expect(query.limit).toHaveBeenCalledWith(1);
    });

    it('returns null when no active branch exists for business', async () => {
        const { supabase, fromMock } = createMockSupabase();
        const query = createQueryBuilder();
        query.maybeSingle.mockResolvedValue({ data: null, error: null });
        fromMock.mockReturnValue(query);

        const repo = new SupabaseBranchRepository(supabase);

        await expect(repo.findFirstActiveByBizId('biz1')).resolves.toBeNull();
    });

    it('rethrows first active branch lookup errors', async () => {
        const { supabase, fromMock } = createMockSupabase();
        const query = createQueryBuilder();
        const error = new Error('branch list failed');
        query.maybeSingle.mockResolvedValue({ data: null, error });
        fromMock.mockReturnValue(query);

        const repo = new SupabaseBranchRepository(supabase);

        await expect(repo.findFirstActiveByBizId('biz1')).rejects.toThrow('branch list failed');
    });
});

describe('SupabaseStaffRepository', () => {
    it('returns true when active staff exists', async () => {
        const { supabase, fromMock } = createMockSupabase();
        const query = createQueryBuilder();
        query.eq
            .mockReturnValueOnce(query)
            .mockReturnValueOnce(query)
            .mockResolvedValueOnce({ data: null, error: null, count: 1 });
        fromMock.mockReturnValue(query);

        const repo = new SupabaseStaffRepository(supabase);

        await expect(repo.existsActiveStaff({ bizId: 'biz1', staffId: 'st1' })).resolves.toBe(true);
        expect(query.select).toHaveBeenCalledWith('id', { count: 'exact', head: true });
    });

    it('returns false when active staff count is zero', async () => {
        const { supabase, fromMock } = createMockSupabase();
        const query = createQueryBuilder();
        query.eq
            .mockReturnValueOnce(query)
            .mockReturnValueOnce(query)
            .mockResolvedValueOnce({ data: null, error: null, count: 0 });
        fromMock.mockReturnValue(query);

        const repo = new SupabaseStaffRepository(supabase);

        await expect(repo.existsActiveStaff({ bizId: 'biz1', staffId: 'st1' })).resolves.toBe(false);
    });

    it('rethrows active staff query errors', async () => {
        const { supabase, fromMock } = createMockSupabase();
        const query = createQueryBuilder();
        const error = new Error('staff lookup failed');
        query.eq
            .mockReturnValueOnce(query)
            .mockReturnValueOnce(query)
            .mockResolvedValueOnce({ data: null, error, count: null });
        fromMock.mockReturnValue(query);

        const repo = new SupabaseStaffRepository(supabase);

        await expect(repo.existsActiveStaff({ bizId: 'biz1', staffId: 'st1' })).rejects.toThrow(
            'staff lookup failed',
        );
    });
});

describe('SupabasePromotionRepository', () => {
    it('returns promotion usage count', async () => {
        const { supabase, fromMock } = createMockSupabase();
        const query = createQueryBuilder();
        query.maybeSingle.mockResolvedValue({
            data: { usage_count: 5 },
            error: null,
        });
        fromMock.mockReturnValue(query);

        const repo = new SupabasePromotionRepository(supabase);

        await expect(repo.getUsageCount('promo1')).resolves.toBe(5);
        expect(fromMock).toHaveBeenCalledWith('promotion_usage_stats');
        expect(query.eq).toHaveBeenCalledWith('promotion_id', 'promo1');
    });

    it('returns zero when promotion usage row is missing', async () => {
        const { supabase, fromMock } = createMockSupabase();
        const query = createQueryBuilder();
        query.maybeSingle.mockResolvedValue({ data: null, error: null });
        fromMock.mockReturnValue(query);

        const repo = new SupabasePromotionRepository(supabase);

        await expect(repo.getUsageCount('promo-missing')).resolves.toBe(0);
    });

    it('rethrows promotion usage query errors', async () => {
        const { supabase, fromMock } = createMockSupabase();
        const query = createQueryBuilder();
        const error = new Error('promotion usage failed');
        query.maybeSingle.mockResolvedValue({ data: null, error });
        fromMock.mockReturnValue(query);

        const repo = new SupabasePromotionRepository(supabase);

        await expect(repo.getUsageCount('promo1')).rejects.toThrow('promotion usage failed');
    });
});
