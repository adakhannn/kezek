// apps/web/src/app/staff/page.tsx
import { formatInTimeZone } from 'date-fns-tz';

import StaffCabinet from './StaffCabinet';

import { getStaffContext } from '@/lib/authBiz';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const TZ = process.env.NEXT_PUBLIC_TZ || 'Asia/Bishkek';

export default async function Page() {
    const { supabase, userId, staffId, bizId, branchId } = await getStaffContext();

    // Текущее время в нужной TZ как ISO (с оффсетом)
    const nowISO = formatInTimeZone(new Date(), TZ, "yyyy-MM-dd'T'HH:mm:ssXXX");

    // Параллельные запросы: информация о сотруднике, филиале, услугах и бронях
    const [
        staffResult,
        branchResult,
        servicesResult,
        upcomingResult,
        pastResult
    ] = await Promise.all([
        // Информация о сотруднике
        supabase
            .from('staff')
            .select('full_name, email, phone')
            .eq('id', staffId)
            .single(),
        // Информация о филиале
        supabase
            .from('branches')
            .select('id, name, address')
            .eq('id', branchId)
            .single(),
        // Услуги, которыми владеет сотрудник
        supabase
            .from('service_staff')
            .select(`
                is_active,
                service_id,
                services:services (
                    id,
                    name_ru,
                    duration_min,
                    price_from,
                    price_to,
                    active
                )
            `)
            .eq('staff_id', staffId)
            .eq('is_active', true),
        // Предстоящие брони (исключаем отменённые)
        supabase
            .from('bookings')
            .select(`
                id, status, start_at, end_at, client_name, client_phone,
                services:services!bookings_service_id_fkey ( name_ru, duration_min ),
                branches:branches!bookings_branch_id_fkey ( name, lat, lon, address ),
                businesses:businesses!bookings_biz_id_fkey ( name, slug )
            `)
            .eq('staff_id', staffId)
            .neq('status', 'cancelled')
            .gte('start_at', nowISO)
            .order('start_at', { ascending: true }),
        // Прошедшие брони
        supabase
            .from('bookings')
            .select(`
                id, status, start_at, end_at, client_name, client_phone,
                services:services!bookings_service_id_fkey ( name_ru, duration_min ),
                branches:branches!bookings_branch_id_fkey ( name, lat, lon, address ),
                businesses:businesses!bookings_biz_id_fkey ( name, slug )
            `)
            .eq('staff_id', staffId)
            .lt('start_at', nowISO)
            .order('start_at', { ascending: false }),
    ]);

    const staff = staffResult.data;
    const branch = branchResult.data;
    const servicesData = servicesResult.data ?? [];
    const upcoming = upcomingResult.data ?? [];
    const past = pastResult.data ?? [];

    // Извлекаем услуги из service_staff (только активные услуги)
    const services = servicesData
        .filter(ss => ss.is_active && ss.services)
        .map(ss => {
            const svc = Array.isArray(ss.services) ? ss.services[0] : ss.services;
            return svc;
        })
        .filter((svc): svc is { id: string; name_ru: string; duration_min: number; price_from: number | null; price_to: number | null; active: boolean } => 
            svc !== null && typeof svc === 'object' && 'id' in svc && svc.active === true
        );

    return (
        <StaffCabinet
            userId={userId}
            staffId={staffId}
            staffName={staff?.full_name ?? 'Сотрудник'}
            branch={branch ? { id: branch.id, name: branch.name, address: branch.address } : null}
            services={services}
            upcoming={upcoming}
            past={past}
        />
    );
}

