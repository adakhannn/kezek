import type { BookingStatus, PromotionApplied } from '@core-domain/booking';
import type {
    BookingRepository,
    BranchRepository,
    StaffRepository,
    PromotionRepository,
} from '@core-domain/ports';
import type { SupabaseClient } from '@supabase/supabase-js';


type DbBookingRow = {
    id: string;
    biz_id: string;
    branch_id: string;
    service_id: string;
    staff_id: string;
    status: BookingStatus;
    promotion_applied: PromotionApplied | null;
    start_at: string;
};

/**
 * Реализация BookingRepository поверх Supabase.
 */
export class SupabaseBookingRepository implements BookingRepository {
    constructor(private readonly supabase: SupabaseClient) {}

    async findById(id: string): Promise<DbBookingRow | null> {
        const { data, error } = await this.supabase
            .from('bookings')
            .select(
                'id, biz_id, branch_id, service_id, staff_id, status, promotion_applied, start_at',
            )
            .eq('id', id)
            .maybeSingle<DbBookingRow>();

        if (error) {
            throw error;
        }

        return data ?? null;
    }

    async updateStatus(params: {
        bookingId: string;
        newStatus: BookingStatus;
    }): Promise<void> {
        const { error } = await this.supabase
            .from('bookings')
            .update({ status: params.newStatus })
            .eq('id', params.bookingId);

        if (error) {
            throw error;
        }
    }
}

/**
 * Реализация BranchRepository поверх Supabase.
 */
export class SupabaseBranchRepository implements BranchRepository {
    constructor(private readonly supabase: SupabaseClient) {}

    async findActiveById(params: {
        bizId: string;
        branchId: string;
    }): Promise<{ id: string } | null> {
        const { data, error } = await this.supabase
            .from('branches')
            .select('id')
            .eq('id', params.branchId)
            .eq('biz_id', params.bizId)
            .eq('is_active', true)
            .maybeSingle<{ id: string }>();

        if (error) {
            throw error;
        }

        return data ?? null;
    }

    async findFirstActiveByBizId(bizId: string): Promise<{ id: string } | null> {
        const { data, error } = await this.supabase
            .from('branches')
            .select('id')
            .eq('biz_id', bizId)
            .eq('is_active', true)
            .order('created_at', { ascending: true })
            .limit(1)
            .maybeSingle<{ id: string }>();

        if (error) {
            throw error;
        }

        return data ?? null;
    }
}

/**
 * Реализация StaffRepository поверх Supabase.
 */
export class SupabaseStaffRepository implements StaffRepository {
    constructor(private readonly supabase: SupabaseClient) {}

    async existsActiveStaff(params: {
        bizId: string;
        staffId: string;
    }): Promise<boolean> {
        const { data, error, count } = await this.supabase
            .from('staff')
            .select('id', { count: 'exact', head: true })
            .eq('id', params.staffId)
            .eq('biz_id', params.bizId)
            .eq('is_active', true);

        if (error) {
            throw error;
        }

        return (count ?? 0) > 0;
    }
}

/**
 * Реализация PromotionRepository поверх Supabase.
 */
export class SupabasePromotionRepository implements PromotionRepository {
    constructor(private readonly supabase: SupabaseClient) {}

    async getUsageCount(promotionId: string): Promise<number> {
        const { data, error } = await this.supabase
            .from('promotion_usage_stats')
            .select('usage_count')
            .eq('promotion_id', promotionId)
            .maybeSingle<{ usage_count: number }>();

        if (error) {
            throw error;
        }

        return data?.usage_count ?? 0;
    }
}

