import { isUuid } from '@shared-client/validation';
import { notFound } from 'next/navigation';

import StaffDetailPageClient from './StaffDetailPageClient';

import { LoadFailedNotice } from '@/components/LoadFailedNotice';
import { getBizContextForManagers } from '@/lib/authBiz';
import { logError, logWarn } from '@/lib/log';
import { explicitSchedulingEnabled } from '@/lib/scheduling/config';
import { projectStaffDetailReviews } from '@/lib/staffDetailReviews';
import { readStaffPrivateFields } from '@/lib/staffPrivateFields';
import { getServiceClient } from '@/lib/supabaseService';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export default async function Page({
    params,
}: {
    params: Promise<{ id: string }>;
}) {
    const { id } = await params;
    if (!isUuid(id)) return notFound();
    const { supabase, bizId } = await getBizContextForManagers();

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
        return notFound();
    }
    if (eStaff) {
        logError('StaffDetailPage', 'Failed to load the staff card', { staffId: id, bizId, error: eStaff });
        return <LoadFailedNotice page />;
    }
    if (!staff || String(staff.biz_id) !== String(bizId)) {
        return notFound();
    }
    if (eBr) {
        logError('StaffDetailPage', 'Failed to load branches', { bizId, error: eBr });
        return <LoadFailedNotice page />;
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
        return <LoadFailedNotice page />;
    }
    const reviews = projectStaffDetailReviews(bookingsData ?? []);

    const _activeBranches = (branches ?? []).filter((b) => b.is_active);

    const ratingScore: number | null =
        staff && typeof (staff as { rating_score?: unknown }).rating_score === 'number'
            ? ((staff as { rating_score?: number }).rating_score as number)
            : null;

    return (
        <StaffDetailPageClient
            explicitScheduling={explicitSchedulingEnabled()}
            staff={{
                id: String(staff.id),
                full_name: String(staff.full_name),
                email: staff.email,
                phone: staff.phone,
                branch_id: String(staff.branch_id),
                is_active: Boolean(staff.is_active),
                percent_master: staff.percent_master,
                percent_salon: staff.percent_salon,
                hourly_rate: staff.hourly_rate,
            }}
            branches={(branches ?? []).map(b => ({
                id: String(b.id),
                name: String(b.name),
                is_active: Boolean(b.is_active),
            }))}
            reviews={reviews}
            ratingScore={ratingScore}
            ratingWeights={
                ratingConfig
                    ? {
                          reviews: Number(ratingConfig.staff_reviews_weight),
                          productivity: Number(ratingConfig.staff_productivity_weight),
                          loyalty: Number(ratingConfig.staff_loyalty_weight),
                          discipline: Number(ratingConfig.staff_discipline_weight),
                          windowDays: Number(ratingConfig.window_days),
                      }
                    : null
            }
        />
    );
}
