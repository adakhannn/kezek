/**
 * @deprecated Используйте /api/staff/finance?staffId={id}&date={date} вместо этого endpoint
 * Этот endpoint сохранен для обратной совместимости
 * 
 * Миграция:
 * - Старый: GET /api/dashboard/staff/[id]/finance?date=YYYY-MM-DD
 * - Новый: GET /api/staff/finance?staffId={id}&date=YYYY-MM-DD
 */
// apps/web/src/app/api/dashboard/staff/[id]/finance/route.ts
import { formatInTimeZone } from 'date-fns-tz';
import { NextResponse } from 'next/server';

import { getBizContextForManagers } from '@/lib/authBiz';
import { logError, logDebug, logWarn } from '@/lib/log';
import { getRouteParamUuid } from '@/lib/routeParams';
import { getServiceClient } from '@/lib/supabaseService';
import { TZ } from '@/lib/time';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(
    req: Request,
    context: unknown
) {
    try {
        // Предупреждение о deprecated endpoint
        logWarn('StaffFinance', 'Deprecated endpoint used. Please migrate to /api/staff/finance?staffId={id}');
        
        // Валидация UUID для предотвращения потенциальных проблем безопасности
        const staffId = await getRouteParamUuid(context, 'id');
        const { supabase, bizId } = await getBizContextForManagers();

        // Получаем параметр date из query string, если он есть
        const { searchParams } = new URL(req.url);
        const dateParam = searchParams.get('date');
        let targetDate: Date;
        if (dateParam) {
            // Валидация формата даты (YYYY-MM-DD)
            const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
            if (!dateRegex.test(dateParam)) {
                logError('StaffFinance', 'Invalid date format', { dateParam });
                return NextResponse.json(
                    { ok: false, error: 'Invalid date format. Expected YYYY-MM-DD' },
                    { status: 400 }
                );
            }
            
            // Парсим дату из параметра (формат YYYY-MM-DD)
            const [year, month, day] = dateParam.split('-').map(Number);
            
            // Валидация значений даты
            if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) {
                logError('StaffFinance', 'Invalid date values', { dateParam, year, month, day });
                return NextResponse.json(
                    { ok: false, error: 'Invalid date values' },
                    { status: 400 }
                );
            }
            
            // Проверяем диапазоны значений
            if (year < 1900 || year > 2100 || month < 1 || month > 12 || day < 1 || day > 31) {
                logError('StaffFinance', 'Date out of valid range', { dateParam, year, month, day });
                return NextResponse.json(
                    { ok: false, error: 'Date out of valid range' },
                    { status: 400 }
                );
            }
            
            targetDate = new Date(year, month - 1, day);
            
            // Проверяем, что дата валидна (например, 2024-02-30 будет невалидной)
            if (targetDate.getFullYear() !== year || 
                targetDate.getMonth() !== month - 1 || 
                targetDate.getDate() !== day) {
                logError('StaffFinance', 'Invalid date (e.g., Feb 30)', { dateParam, year, month, day });
                return NextResponse.json(
                    { ok: false, error: 'Invalid date (e.g., day does not exist in month)' },
                    { status: 400 }
                );
            }
        } else {
            targetDate = new Date();
        }

        // Проверяем, что сотрудник принадлежит этому бизнесу
        const { data: staff, error: staffError } = await supabase
            .from('staff')
            .select('id, biz_id, percent_master, percent_salon, hourly_rate')
            .eq('id', staffId)
            .maybeSingle();

        if (staffError) {
            logError('StaffFinance', 'Error loading staff', { 
                error: staffError.message, 
                staffId,
                bizId 
            });
            return NextResponse.json(
                { ok: false, error: 'Staff not found or access denied' },
                { status: 404 }
            );
        }

        if (!staff) {
            logDebug('StaffFinance', 'Staff not found', { staffId, bizId });
            return NextResponse.json(
                { ok: false, error: 'Staff not found or access denied' },
                { status: 404 }
            );
        }

        // Нормализуем значения для надежного сравнения
        // bizId из getBizContextForManagers всегда строка, но нормализуем на всякий случай
        const normalizedBizId = bizId ? String(bizId).trim() : null;
        const normalizedStaffBizId = staff.biz_id != null ? String(staff.biz_id).trim() : null;

        // Проверяем принадлежность к бизнесу
        if (!normalizedStaffBizId || !normalizedBizId || normalizedStaffBizId !== normalizedBizId) {
            logError('StaffFinance', 'Staff business mismatch', {
                staffId,
                staffBizId: normalizedStaffBizId,
                requestedBizId: normalizedBizId,
                staffBizIdType: typeof staff.biz_id,
                bizIdType: typeof bizId,
            });
            return NextResponse.json(
                { ok: false, error: 'Staff not found or access denied' },
                { status: 404 }
            );
        }

        const staffPercentMaster = Number(staff.percent_master ?? 60);
        const staffPercentSalon = Number(staff.percent_salon ?? 40);
        const hourlyRate = staff.hourly_rate ? Number(staff.hourly_rate) : null;

        // Дата в локальной TZ (без времени)
        const ymd = formatInTimeZone(targetDate, TZ, 'yyyy-MM-dd');

        // Проверяем, выходной ли для выбранной даты (только если это сегодня)
        let isDayOff = false;
        const today = formatInTimeZone(new Date(), TZ, 'yyyy-MM-dd');
        if (ymd === today) {
            // 1. Проверяем staff_time_off
            const { data: timeOffs } = await supabase
                .from('staff_time_off')
                .select('id')
                .eq('biz_id', bizId)
                .eq('staff_id', staffId)
                .lte('date_from', ymd)
                .gte('date_to', ymd);

            if (timeOffs && timeOffs.length > 0) {
                isDayOff = true;
            } else {
                // 2. Проверяем staff_schedule_rules для конкретной даты
                const { data: dateRule } = await supabase
                    .from('staff_schedule_rules')
                    .select('intervals')
                    .eq('biz_id', bizId)
                    .eq('staff_id', staffId)
                    .eq('kind', 'date')
                    .eq('date_on', ymd)
                    .eq('is_active', true)
                    .maybeSingle();

                if (dateRule && Array.isArray(dateRule.intervals) && dateRule.intervals.length === 0) {
                    isDayOff = true;
                }
            }
        }

        // Используем service client для обхода RLS, так как владелец должен видеть данные своих сотрудников
        const admin = getServiceClient();

        // Смена за выбранную дату
        const { data: shift, error: shiftError } = await admin
            .from('staff_shifts')
            .select('*')
            .eq('biz_id', bizId)
            .eq('staff_id', staffId)
            .eq('shift_date', ymd)
            .maybeSingle();

        if (shiftError) {
            logError('StaffFinance', 'Error loading shift', shiftError);
            return NextResponse.json(
                { ok: false, error: shiftError.message },
                { status: 500 }
            );
        }

        // Позиции по клиентам для текущей смены
        // Используем service client для обхода RLS, так как владелец должен видеть данные своих сотрудников
        type ShiftItemRow = {
            id: string;
            client_name: string | null;
            service_name: string | null;
            service_amount: number;
            consumables_amount: number;
            note: string | null;
            booking_id: string | null;
            created_at: string | null;
        };
        
        let items: ShiftItemRow[] = [];
        if (shift && shift.id) {
            const { data: itemsData, error: itemsError } = await admin
                .from('staff_shift_items')
                .select('id, client_name, service_name, service_amount, consumables_amount, note, booking_id, created_at')
                .eq('shift_id', shift.id)
                .order('created_at', { ascending: false })
                .order('id', { ascending: false });

            if (itemsError) {
                logError('StaffFinance', 'Error loading shift items', itemsError);
            } else {
                items = Array.isArray(itemsData) ? itemsData : [];
            }
        }

        // Записи (bookings) сотрудника за выбранную дату для выбора клиентов
        const dateStart = `${ymd}T00:00:00`;
        const dateEnd = `${ymd}T23:59:59`;
        const { data: dateBookings, error: bookingsError } = await supabase
            .from('bookings')
            .select('id, client_name, client_phone, start_at, services:services!bookings_service_id_fkey (name_ru, name_ky, name_en)')
            .eq('staff_id', staffId)
            .gte('start_at', dateStart)
            .lte('start_at', dateEnd)
            .neq('status', 'cancelled')
            .order('start_at', { ascending: true });

        if (bookingsError) {
            logError('StaffFinance', 'Error loading bookings', bookingsError);
        }

        // Услуги сотрудника для выпадающего списка
        const { data: staffServices, error: servicesError } = await supabase
            .from('service_staff')
            .select('services:services!inner (name_ru, name_ky, name_en)')
            .eq('staff_id', staffId)
            .eq('is_active', true)
            .eq('services.active', true);

        if (servicesError) {
            logError('StaffFinance', 'Error loading staff services', servicesError);
        }

        type ServiceStaffRow = {
            services: {
                name_ru: string;
                name_ky?: string | null;
                name_en?: string | null;
            } | {
                name_ru: string;
                name_ky?: string | null;
                name_en?: string | null;
            }[] | null;
        };
        
        type ServiceNameResult = {
            name_ru: string;
            name_ky: string | null;
            name_en: string | null;
        };
        
        const availableServices = (Array.isArray(staffServices) ? staffServices : [])
            .map((ss: ServiceStaffRow): ServiceNameResult | null => {
                // Проверяем наличие services
                if (!ss || !ss.services) {
                    return null;
                }
                
                // Обрабатываем массив или одиночный объект
                const svc = Array.isArray(ss.services) 
                    ? (ss.services.length > 0 ? ss.services[0] : null)
                    : ss.services;
                
                // Проверяем наличие обязательного поля name_ru
                if (!svc || typeof svc !== 'object' || !svc.name_ru || typeof svc.name_ru !== 'string') {
                    return null;
                }
                
                return { 
                    name_ru: svc.name_ru, 
                    name_ky: (svc.name_ky && typeof svc.name_ky === 'string') ? svc.name_ky : null, 
                    name_en: (svc.name_en && typeof svc.name_en === 'string') ? svc.name_en : null 
                };
            })
            .filter((svc): svc is ServiceNameResult => 
                svc !== null && 
                typeof svc === 'object' && 
                'name_ru' in svc && 
                typeof svc.name_ru === 'string' &&
                svc.name_ru.length > 0
            );

        // Расчет текущих часов работы и суммы за выход для открытой смены
        let currentHoursWorked: number | null = null;
        let currentGuaranteedAmount: number | null = null;

        if (shift && shift.status === 'open' && shift.opened_at && hourlyRate) {
            const openedAt = new Date(shift.opened_at);
            const nowDate = new Date();
            const diffMs = nowDate.getTime() - openedAt.getTime();
            const diffHours = diffMs / (1000 * 60 * 60);
            currentHoursWorked = Math.max(0, diffHours);
            currentGuaranteedAmount = currentHoursWorked * hourlyRate;
        }

        // Статистика за последние 30 дней
        const thirtyDaysAgo = new Date(targetDate);
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        const statsStart = formatInTimeZone(thirtyDaysAgo, TZ, 'yyyy-MM-dd');

        const { data: recentShifts, error: statsError } = await admin
            .from('staff_shifts')
            .select('total_amount, master_share, salon_share, late_minutes')
            .eq('biz_id', bizId)
            .eq('staff_id', staffId)
            .eq('status', 'closed')
            .gte('shift_date', statsStart)
            .order('shift_date', { ascending: false });

        if (statsError) {
            logError('StaffFinance', 'Error loading stats', statsError);
        }

        // Загружаем все смены (не только закрытые) для статистики - клиент фильтрует по статусу
        const { data: allShifts, error: allShiftsError } = await admin
            .from('staff_shifts')
            .select('shift_date, status, total_amount, master_share, salon_share, late_minutes')
            .eq('biz_id', bizId)
            .eq('staff_id', staffId)
            .order('shift_date', { ascending: false });

        if (allShiftsError) {
            logError('StaffFinance', 'Error loading all shifts', allShiftsError);
        }

        const stats = {
            totalAmount: 0,
            totalMaster: 0,
            totalSalon: 0,
            totalLateMinutes: 0,
            shiftsCount: 0,
        };

        // Тип для статистики смены
        type ShiftStatsRow = {
            total_amount: number | null;
            master_share: number | null;
            salon_share: number | null;
            late_minutes: number | null;
        };

        if (Array.isArray(recentShifts)) {
            for (const s of recentShifts) {
                // Безопасное преобразование с проверками на null/undefined
                const totalAmount = typeof s.total_amount === 'number' && !isNaN(s.total_amount) ? s.total_amount : 0;
                const masterShare = typeof s.master_share === 'number' && !isNaN(s.master_share) ? s.master_share : 0;
                const salonShare = typeof s.salon_share === 'number' && !isNaN(s.salon_share) ? s.salon_share : 0;
                const lateMinutes = typeof s.late_minutes === 'number' && !isNaN(s.late_minutes) ? s.late_minutes : 0;
                
                stats.totalAmount += totalAmount;
                stats.totalMaster += masterShare;
                stats.totalSalon += salonShare;
                stats.totalLateMinutes += lateMinutes;
                stats.shiftsCount += 1;
            }
        }

        return NextResponse.json({
            ok: true,
            today: shift
                ? {
                      exists: true,
                      status: shift.status,
                      shift: {
                          id: shift.id,
                          shift_date: shift.shift_date,
                          opened_at: shift.opened_at ?? null,
                          closed_at: shift.closed_at ?? null,
                          expected_start: shift.expected_start ?? null,
                          late_minutes: typeof shift.late_minutes === 'number' && !isNaN(shift.late_minutes) ? shift.late_minutes : 0,
                          status: shift.status as 'open' | 'closed',
                          total_amount: typeof shift.total_amount === 'number' && !isNaN(shift.total_amount) ? shift.total_amount : 0,
                          consumables_amount: typeof shift.consumables_amount === 'number' && !isNaN(shift.consumables_amount) ? shift.consumables_amount : 0,
                          master_share: typeof shift.master_share === 'number' && !isNaN(shift.master_share) ? shift.master_share : 0,
                          salon_share: typeof shift.salon_share === 'number' && !isNaN(shift.salon_share) ? shift.salon_share : 0,
                          percent_master: staffPercentMaster,
                          percent_salon: staffPercentSalon,
                          hours_worked: (shift.hours_worked && typeof shift.hours_worked === 'number' && !isNaN(shift.hours_worked)) ? shift.hours_worked : null,
                          hourly_rate: hourlyRate,
                          guaranteed_amount: (shift.guaranteed_amount && typeof shift.guaranteed_amount === 'number' && !isNaN(shift.guaranteed_amount)) ? shift.guaranteed_amount : undefined,
                          topup_amount: (shift.topup_amount && typeof shift.topup_amount === 'number' && !isNaN(shift.topup_amount)) ? shift.topup_amount : undefined,
                      },
                      items: Array.isArray(items) ? items : [],
                  }
                : {
                      exists: false,
                      status: 'none',
                      shift: null,
                      items: [],
                  },
            bookings: dateBookings ?? [],
            services: availableServices,
            // Возвращаем все смены (не только закрытые), фильтрация по статусу на клиенте
            allShifts: (Array.isArray(allShifts) ? allShifts : []).map((s) => {
                // Безопасное преобразование с проверками на null/undefined
                const totalAmount = typeof s.total_amount === 'number' && !isNaN(s.total_amount) ? s.total_amount : 0;
                const masterShare = typeof s.master_share === 'number' && !isNaN(s.master_share) ? s.master_share : 0;
                const salonShare = typeof s.salon_share === 'number' && !isNaN(s.salon_share) ? s.salon_share : 0;
                const lateMinutes = typeof s.late_minutes === 'number' && !isNaN(s.late_minutes) ? s.late_minutes : 0;
                
                return {
                    shift_date: typeof s.shift_date === 'string' ? s.shift_date : '',
                    status: typeof s.status === 'string' ? s.status : 'closed',
                    total_amount: totalAmount,
                    master_share: masterShare,
                    salon_share: salonShare,
                    late_minutes: lateMinutes,
                };
            }),
            staffPercentMaster,
            staffPercentSalon,
            hourlyRate,
            currentHoursWorked,
            currentGuaranteedAmount,
            isDayOff,
            stats,
        });
    } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        logError('StaffFinance', 'Unexpected error', e);
        return NextResponse.json(
            { ok: false, error: msg },
            { status: 500 }
        );
    }
}

