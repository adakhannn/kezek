import { notFound } from 'next/navigation';

import StaffDetailPageClient from './StaffDetailPageClient';

import { getBizContextForManagers } from '@/lib/authBiz';
import { getServiceClient } from '@/lib/supabaseService';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export default async function Page({
    params,
}: {
    params: Promise<{ id: string }>;
}) {
    const { id } = await params;
    const { supabase, bizId } = await getBizContextForManagers();

    // Грузим сотрудника, список филиалов и конфиг рейтинга
    const [
        { data: staff, error: eStaff },
        { data: branches, error: eBr },
        { data: ratingConfig },
    ] = await Promise.all([
        supabase
            .from('staff')
            .select('id,full_name,email,phone,branch_id,is_active,biz_id,percent_master,percent_salon,hourly_rate,rating_score')
            .eq('id', id)
            .maybeSingle(),
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

    if (eStaff) {
        return <main className="p-6 text-red-600">{eStaff.message}</main>;
    }
    if (!staff || String(staff.biz_id) !== String(bizId)) {
        return notFound();
    }
    if (eBr) {
        return <main className="p-6 text-red-600">{eBr.message}</main>;
    }

    // Используем service client для обхода RLS при загрузке отзывов
    // (владелец бизнеса должен видеть отзывы для своих сотрудников)
    const admin = getServiceClient();

    // Получаем booking_ids для сотрудника и информацию о бронях
    const { data: bookingsData } = await admin
        .from('bookings')
        .select('id, start_at, end_at, client_name, client_phone, service_id')
        .eq('staff_id', id)
        .limit(100);

    const bookingIds = (bookingsData ?? []).map(b => b.id);

    // Загружаем отзывы по booking_ids и данные об услугах
    const [{data: reviewsData}, {data: servicesData}] = await Promise.all([
        // Загружаем отзывы для bookings этого сотрудника (используя service client для обхода RLS)
        bookingIds.length > 0
            ? admin
                .from('reviews')
                .select('id, rating, comment, created_at, booking_id')
                .in('booking_id', bookingIds)
                .order('created_at', { ascending: false })
            : Promise.resolve({ data: [], error: null }),
        // Загружаем информацию об услугах
        bookingIds.length > 0
            ? admin
                .from('bookings')
                .select('id, service_id, services:services!bookings_service_id_fkey(name_ru, name_ky, name_en)')
                .in('id', bookingIds)
            : Promise.resolve({ data: [], error: null }),
    ]);

    // Создаем мапу booking_id -> service для быстрого поиска
    const serviceMap = new Map<string, { name_ru: string; name_ky?: string | null; name_en?: string | null }>();
    (servicesData ?? []).forEach((booking: { id: string; service_id?: string | null; services?: unknown }) => {
        if (!booking.service_id) return;
        const service = Array.isArray(booking.services) ? booking.services[0] : booking.services;
        if (service && typeof service === 'object' && service !== null && 'name_ru' in service) {
            serviceMap.set(booking.id, service as { name_ru: string; name_ky?: string | null; name_en?: string | null });
        }
    });

    // Создаем мапу booking_id -> booking для быстрого поиска
    const bookingMap = new Map<string, { start_at: string; end_at: string; client_name: string | null; client_phone: string | null }>();
    (bookingsData ?? []).forEach((booking: { id: string; start_at: string; end_at: string; client_name: string | null; client_phone: string | null }) => {
        bookingMap.set(booking.id, {
            start_at: booking.start_at,
            end_at: booking.end_at,
            client_name: booking.client_name,
            client_phone: booking.client_phone,
        });
    });

    // Обрабатываем отзывы: объединяем данные из reviews и bookings
    type ReviewData = {
        id: string;
        rating: number;
        comment: string | null;
        created_at: string;
        booking_id: string;
        service_name: string | null;
        start_at: string;
        end_at: string;
        client_name: string | null;
        client_phone: string | null;
    };
    
    const reviews: ReviewData[] = (reviewsData ?? [])
        .map((review: { id: string; rating: number; comment: string | null; created_at: string; booking_id: string }) => {
            if (!review || !review.booking_id) return null;
            
            // Получаем booking из мапы
            const booking = bookingMap.get(review.booking_id);
            if (!booking) return null;
            
            // Получаем название услуги из мапы
            const service = serviceMap.get(review.booking_id);
            let serviceName: string | null = null;
            if (service) {
                if (service.name_ky) {
                    serviceName = String(service.name_ky);
                } else if (service.name_en) {
                    serviceName = String(service.name_en);
                } else {
                    serviceName = String(service.name_ru);
                }
            }
            
            return {
                id: review.id,
                rating: review.rating,
                comment: review.comment,
                created_at: review.created_at,
                booking_id: review.booking_id,
                service_name: serviceName,
                start_at: booking.start_at,
                end_at: booking.end_at,
                client_name: booking.client_name,
                client_phone: booking.client_phone,
            };
        })
        .filter((r): r is ReviewData => r !== null);

    const activeBranches = (branches ?? []).filter((b) => b.is_active);

    const ratingScore: number | null =
        staff && typeof (staff as { rating_score?: unknown }).rating_score === 'number'
            ? ((staff as { rating_score?: number }).rating_score as number)
            : null;

    return (
        <StaffDetailPageClient
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
