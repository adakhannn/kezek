import type { SupabaseClient } from '@supabase/supabase-js';

import { logError, logWarn } from '@/lib/log';
import { explicitSchedulingEnabled } from '@/lib/scheduling/config';
import { readLegacyScheduleContext, type LegacyScheduleContext } from '@/lib/scheduling/legacyContext';
import { loadStaffApplicationSummary, type StaffApplicationSummary } from '@/lib/staffApplicationSummary';
import { projectStaffDetailReviews } from '@/lib/staffDetailReviews';
import { listPendingInvitationStaffIds } from '@/lib/staffInvitationService';
import { readStaffPrivateFields } from '@/lib/staffPrivateFields';
import { createSupabaseAdminClient } from '@/lib/supabaseHelpers';
import { getServiceClient } from '@/lib/supabaseService';

/**
 * Reads of the manager's staff pages (/dashboard/staff, /dashboard/staff/[id], its schedule), shared
 * by the server components and the JSON routes the mobile app uses, so both show the same data.
 * Every caller has resolved the manager context first (getBizContextForManagers): `supabase` acts
 * as that user (RLS), `bizId` is the current business.
 */
export type DashboardStaffContext = { supabase: SupabaseClient; bizId: string; userId: string };

export type DashboardStaffRow = {
    id: string;
    full_name: string;
    is_active: boolean | null;
    branch_id: string;
    /** Public photo URL (the master uploads it in the staff cabinet); null shows initials. */
    avatar_url: string | null;
    /** Contacts the owner already sees on the card; the app uses them to tell apart namesakes. */
    email: string | null;
    phone: string | null;
    // join объектом, а не массивом
    branches: { name: string } | null;
};

export type DashboardStaffList = {
    rows: DashboardStaffRow[];
    /** Cards waiting for the invited person (API-06). */
    pendingInvitationStaffIds: string[];
    staffApplications: StaffApplicationSummary;
};

export async function loadDashboardStaffList(ctx: DashboardStaffContext): Promise<{ ok: true; data: DashboardStaffList } | { ok: false }> {
    const { supabase, bizId, userId } = ctx;
    const staffApplications = await loadStaffApplicationSummary(userId, bizId);

    const { data: rows, error } = await supabase
        .from('staff')
        .select('id,full_name,is_active,branch_id,avatar_url,email,phone,branches(name)')
        .eq('biz_id', bizId)
        .order('full_name')
        .returns<DashboardStaffRow[]>();

    if (error) {
        logError('DashboardStaffPage', 'Failed to load staff', { bizId, error });
        return { ok: false };
    }

    // Cards waiting for the invited person (API-06). The table is service role only; the manager's
    // business context was resolved above, and the query is limited to that business.
    let pendingInvitationStaffIds: string[] = [];
    try {
        const pending = await listPendingInvitationStaffIds(createSupabaseAdminClient(), bizId);
        if (pending.ok) pendingInvitationStaffIds = pending.staffIds;
        else logWarn('StaffPage', 'Pending invitations unavailable', { bizId, error: pending.error });
    } catch (error) {
        logWarn('StaffPage', 'Pending invitations unavailable', { bizId, error });
    }

    return { ok: true, data: { rows: rows ?? [], pendingInvitationStaffIds, staffApplications } };
}

export type DashboardStaffDetail = {
    explicitScheduling: boolean;
    staff: {
        id: string;
        full_name: string;
        email: string | null;
        phone: string | null;
        branch_id: string;
        is_active: boolean;
        percent_master: number | null;
        percent_salon: number | null;
        hourly_rate: number | null;
    };
    branches: Array<{ id: string; name: string; is_active: boolean }>;
    reviews: ReturnType<typeof projectStaffDetailReviews>;
    ratingScore: number | null;
    ratingWeights: {
        reviews: number;
        productivity: number;
        loyalty: number;
        discipline: number;
        windowDays: number;
    } | null;
};

export type DashboardStaffDetailResult =
    | { ok: true; data: DashboardStaffDetail }
    | { ok: false; reason: 'not_found' | 'load_failed' };

export async function loadDashboardStaffDetail(ctx: DashboardStaffContext, id: string): Promise<DashboardStaffDetailResult> {
    const { supabase, bizId } = ctx;

    // Грузим сотрудника, список филиалов и конфиг рейтинга
    const [
        { data: staff, error: eStaff },
        { data: branches, error: eBr },
        { data: ratingConfig },
    ] = await Promise.all([
        // Контакты и условия оплаты доступны только руководству бизнеса и самому сотруднику.
        readStaffPrivateFields(supabase, id),
        supabase
            .from('branches')
            .select('id,name,is_active')
            .eq('biz_id', bizId)
            .order('name'),
        supabase
            .from('rating_global_config')
            .select('staff_reviews_weight, staff_productivity_weight, staff_loyalty_weight, staff_discipline_weight, window_days')
            .eq('is_active', true)
            .order('valid_from', { ascending: false })
            .limit(1)
            .maybeSingle<{
                staff_reviews_weight: number;
                staff_productivity_weight: number;
                staff_loyalty_weight: number;
                staff_discipline_weight: number;
                window_days: number;
            }>(),
    ]);

    if (eStaff?.code === '42501') {
        return { ok: false, reason: 'not_found' };
    }
    if (eStaff) {
        logError('StaffDetailPage', 'Failed to load the staff card', { staffId: id, bizId, error: eStaff });
        return { ok: false, reason: 'load_failed' };
    }
    if (!staff || String(staff.biz_id) !== String(bizId)) {
        return { ok: false, reason: 'not_found' };
    }
    if (eBr) {
        logError('StaffDetailPage', 'Failed to load branches', { bizId, error: eBr });
        return { ok: false, reason: 'load_failed' };
    }

    // Service client для обхода RLS при загрузке отзывов (опционально).
    // В dev окружениях ключ может отсутствовать — тогда работаем через server client с RLS и не падаем.
    let admin = supabase;
    try {
        admin = getServiceClient();
    } catch (e) {
        logWarn('StaffDetailPage', 'SUPABASE_SERVICE_ROLE_KEY not set, using server client (RLS) for reviews', {
            error: e instanceof Error ? e.message : String(e),
        });
    }

    // Оптимизированный запрос: загружаем bookings с отзывами и услугами в одном запросе (фильтр по biz_id)
    const { data: bookingsData, error: bookingsError } = await admin
        .from('bookings')
        .select(`
            id,
            start_at,
            end_at,
            client_name,
            client_phone,
            service_id,
            services:services!bookings_service_id_fkey(name_ru, name_ky, name_en),
            reviews:reviews!reviews_booking_id_fkey(id, rating, comment, created_at)
        `)
        .eq('biz_id', bizId)
        .eq('staff_id', id)
        .order('start_at', { ascending: false })
        .limit(100);

    // FE-08: a failed read is an error, not "no reviews yet".
    if (bookingsError) {
        logError('StaffDetailPage', 'Failed to load staff bookings and reviews', { staffId: id, bizId, error: bookingsError });
        return { ok: false, reason: 'load_failed' };
    }

    const ratingScore: number | null =
        typeof (staff as { rating_score?: unknown }).rating_score === 'number'
            ? ((staff as { rating_score?: number }).rating_score as number)
            : null;

    return {
        ok: true,
        data: {
            explicitScheduling: explicitSchedulingEnabled(),
            staff: {
                id: String(staff.id),
                full_name: String(staff.full_name),
                email: staff.email,
                phone: staff.phone,
                branch_id: String(staff.branch_id),
                is_active: Boolean(staff.is_active),
                percent_master: staff.percent_master,
                percent_salon: staff.percent_salon,
                hourly_rate: staff.hourly_rate,
            },
            branches: (branches ?? []).map((b) => ({
                id: String(b.id),
                name: String(b.name),
                is_active: Boolean(b.is_active),
            })),
            reviews: projectStaffDetailReviews(bookingsData ?? []),
            ratingScore,
            ratingWeights: ratingConfig
                ? {
                      reviews: Number(ratingConfig.staff_reviews_weight),
                      productivity: Number(ratingConfig.staff_productivity_weight),
                      loyalty: Number(ratingConfig.staff_loyalty_weight),
                      discipline: Number(ratingConfig.staff_discipline_weight),
                      windowDays: Number(ratingConfig.window_days),
                  }
                : null,
        },
    };
}

export type DashboardStaffScheduleContext = {
    staff: { id: string; full_name: string; branch_id: string };
    /** Active branches of the business, by name. */
    branches: Array<{ id: string; name: string }>;
    explicitScheduling: boolean;
    /** The legacy editor's server reads; null with explicit scheduling. */
    legacy: LegacyScheduleContext | null;
};

export type DashboardStaffScheduleContextResult =
    | { ok: true; data: DashboardStaffScheduleContext }
    | { ok: false; reason: 'not_found' | 'load_failed'; stage?: 'staff' | 'branches'; message?: string };

/** What /dashboard/staff/[id]/schedule reads on the server before it chooses an editor. */
export async function loadDashboardStaffScheduleContext(ctx: DashboardStaffContext, id: string): Promise<DashboardStaffScheduleContextResult> {
    const { supabase, bizId } = ctx;

    // сотрудник
    const { data: staff, error: eStaff } = await supabase
        .from('staff')
        .select('id, full_name, branch_id, biz_id')
        .eq('id', id)
        .maybeSingle();

    if (eStaff) return { ok: false, reason: 'load_failed', stage: 'staff', message: eStaff.message };
    if (!staff || String(staff.biz_id) !== String(bizId)) return { ok: false, reason: 'not_found' };

    // филиалы бизнеса
    const { data: branches, error: eBranches } = await supabase
        .from('branches')
        .select('id,name,is_active')
        .eq('biz_id', bizId)
        .order('name');

    if (eBranches) return { ok: false, reason: 'load_failed', stage: 'branches', message: eBranches.message };

    const explicitScheduling = explicitSchedulingEnabled();
    const legacy = explicitScheduling
        ? null
        : await readLegacyScheduleContext(String(bizId), String(staff.id), String(staff.branch_id));

    return {
        ok: true,
        data: {
            staff: { id: String(staff.id), full_name: String(staff.full_name || ''), branch_id: String(staff.branch_id) },
            branches: (branches ?? [])
                .filter((b) => b.is_active === true)
                .map((b) => ({ id: String(b.id), name: String(b.name) })),
            explicitScheduling,
            legacy,
        },
    };
}
