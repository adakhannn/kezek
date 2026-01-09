import { notFound } from 'next/navigation';

import StaffDetailPageClient from './StaffDetailPageClient';

import { getBizContextForManagers } from '@/lib/authBiz';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export default async function Page({
    params,
}: {
    params: Promise<{ id: string }>;
}) {
    const { id } = await params;
    const {supabase, bizId} = await getBizContextForManagers();

    // Грузим сотрудника, список филиалов текущего бизнеса и отзывы
    const [{data: staff, error: eStaff}, {data: branches, error: eBr}, {data: reviewsData}] = await Promise.all([
        supabase
            .from('staff')
            .select('id,full_name,email,phone,branch_id,is_active,biz_id,percent_master,percent_salon,hourly_rate')
            .eq('id', id)
            .maybeSingle(),
        supabase
            .from('branches')
            .select('id,name,is_active')
            .eq('biz_id', bizId)
            .order('name'),
        supabase
            .from('bookings')
            .select(`
                id, start_at, end_at, client_name, client_phone,
                services:services!bookings_service_id_fkey ( name_ru ),
                reviews:reviews ( id, rating, comment, created_at )
            `)
            .eq('staff_id', id)
            .order('start_at', { ascending: false })
            .limit(100),
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

    // Обрабатываем отзывы: фильтруем только те, где есть отзыв
    const reviews = (reviewsData ?? [])
        .map(booking => {
            const review = Array.isArray(booking.reviews) ? booking.reviews[0] : booking.reviews;
            if (!review) return null;
            const service = Array.isArray(booking.services) ? booking.services[0] : booking.services;
            // Получаем название услуги в зависимости от языка
            let serviceName: string | null = null;
            if (service && typeof service === 'object') {
                if ('name_ky' in service && service.name_ky) {
                    serviceName = String(service.name_ky);
                } else if ('name_en' in service && service.name_en) {
                    serviceName = String(service.name_en);
                } else if ('name_ru' in service) {
                    serviceName = String(service.name_ru);
                }
            }
            return {
                id: review.id,
                rating: review.rating,
                comment: review.comment,
                created_at: review.created_at,
                booking_id: booking.id,
                service_name: serviceName,
                start_at: booking.start_at,
                end_at: booking.end_at,
                client_name: booking.client_name,
                client_phone: booking.client_phone,
            };
        })
        .filter((r): r is NonNullable<typeof r> => r !== null);

    const activeBranches = (branches ?? []).filter(b => b.is_active);

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
        />
    );
}
