// apps/web/src/app/staff/bookings/page.tsx
import { formatInTimeZone } from 'date-fns-tz';

import StaffBookingsView from './StaffBookingsView';

import { getStaffContext } from '@/lib/authBiz';
import { TZ } from '@/lib/time';

export default async function StaffBookingsPage() {
    const { supabase, staffId, bizId, branchId } = await getStaffContext();

    // Текущее время в нужной TZ как ISO (с оффсетом)
    const nowISO = formatInTimeZone(new Date(), TZ, "yyyy-MM-dd'T'HH:mm:ssXXX");

    // Параллельные запросы для предстоящих и прошедших броней, а также данных для создания бронирований
    const [upcomingResult, pastResult, servicesResult, staffResult, branchesResult] = await Promise.all([
        // Предстоящие брони (исключаем отменённые) - записи, которые еще не закончились (end_at >= now)
        supabase
            .from('bookings')
            .select(`
                id, status, start_at, end_at, client_name, client_phone,
                services:services!bookings_service_id_fkey ( name_ru, name_ky, name_en, duration_min ),
                branches:branches!bookings_branch_id_fkey ( name, lat, lon, address ),
                businesses:businesses!bookings_biz_id_fkey ( name, slug )
            `)
            .eq('staff_id', staffId)
            .neq('status', 'cancelled')
            .gte('end_at', nowISO)
            .order('start_at', { ascending: true }),
        // Прошедшие брони - записи, которые уже закончились (end_at < now)
        supabase
            .from('bookings')
            .select(`
                id, status, start_at, end_at, client_name, client_phone,
                services:services!bookings_service_id_fkey ( name_ru, name_ky, name_en, duration_min ),
                branches:branches!bookings_branch_id_fkey ( name, lat, lon, address ),
                businesses:businesses!bookings_biz_id_fkey ( name, slug )
            `)
            .eq('staff_id', staffId)
            .lt('end_at', nowISO)
            .order('start_at', { ascending: false }),
        // Услуги для создания бронирований (только активные)
        supabase
            .from('services')
            .select('id, name_ru, name_ky, name_en, duration_min, active, branch_id')
            .eq('biz_id', bizId)
            .eq('active', true)
            .order('name_ru'),
        // Сотрудники для создания бронирований (только активные)
        supabase
            .from('staff')
            .select('id, full_name, is_active, branch_id')
            .eq('biz_id', bizId)
            .eq('is_active', true)
            .order('full_name'),
        // Филиалы для создания бронирований (только активные)
        supabase
            .from('branches')
            .select('id, name, is_active')
            .eq('biz_id', bizId)
            .eq('is_active', true)
            .order('name'),
    ]);

    const upcoming = upcomingResult.data ?? [];
    const past = pastResult.data ?? [];
    const services = servicesResult.data ?? [];
    const staff = staffResult.data ?? [];
    const branches = branchesResult.data ?? [];

    return (
        <StaffBookingsView
            bizId={bizId}
            staffId={staffId}
            branchId={branchId}
            upcoming={upcoming}
            past={past}
            services={services}
            staff={staff}
            branches={branches}
        />
    );
}

