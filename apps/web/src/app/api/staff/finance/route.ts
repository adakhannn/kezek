/**
 * Единый API endpoint для получения данных смены сотрудника
 * Поддерживает как сотрудников (через getStaffContext), так и менеджеров (через getBizContextForManagers)
 * 
 * Query параметры:
 * - staffId (опционально) - ID сотрудника (для менеджеров)
 * - date (опционально) - дата в формате YYYY-MM-DD (по умолчанию сегодня)
 */

import { formatInTimeZone } from 'date-fns-tz';
import { NextResponse } from 'next/server';

import { getBizContextForManagers, getStaffContext } from '@/lib/authBiz';
import { logError, logDebug } from '@/lib/log';
import { TZ } from '@/lib/time';
import { getShiftData } from '@/app/staff/finance/services/shiftDataService';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(req: Request) {
    try {
        const { searchParams } = new URL(req.url);
        const staffIdParam = searchParams.get('staffId');
        const dateParam = searchParams.get('date');

        // Определяем целевую дату
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

        let staffId: string;
        let bizId: string;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        let supabase: any;
        let useServiceClient = false;

        // Если передан staffId, это запрос от менеджера/владельца
        if (staffIdParam) {
            const context = await getBizContextForManagers();
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            supabase = context.supabase as any;
            bizId = context.bizId;

            // Проверяем, что сотрудник принадлежит этому бизнесу
            const { data: staff, error: staffError } = await supabase
                .from('staff')
                .select('id, biz_id')
                .eq('id', staffIdParam)
                .maybeSingle();

            if (staffError) {
                logError('StaffFinance', 'Error loading staff', { 
                    error: staffError.message, 
                    staffId: staffIdParam,
                    bizId 
                });
                return NextResponse.json(
                    { ok: false, error: 'Staff not found or access denied' },
                    { status: 404 }
                );
            }

            if (!staff) {
                logDebug('StaffFinance', 'Staff not found', { staffId: staffIdParam, bizId });
                return NextResponse.json(
                    { ok: false, error: 'Staff not found or access denied' },
                    { status: 404 }
                );
            }

            // Нормализуем значения для надежного сравнения
            const normalizedBizId = bizId ? String(bizId).trim() : null;
            const normalizedStaffBizId = staff.biz_id != null ? String(staff.biz_id).trim() : null;

            // Проверяем принадлежность к бизнесу
            if (!normalizedStaffBizId || !normalizedBizId || normalizedStaffBizId !== normalizedBizId) {
                logError('StaffFinance', 'Staff business mismatch', {
                    staffId: staffIdParam,
                    staffBizId: normalizedStaffBizId,
                    requestedBizId: normalizedBizId,
                });
                return NextResponse.json(
                    { ok: false, error: 'Staff not found or access denied' },
                    { status: 404 }
                );
            }

            staffId = staffIdParam;
            useServiceClient = true; // Используем service client для обхода RLS
        } else {
            // Это запрос от сотрудника (используем его контекст)
            const context = await getStaffContext();
            supabase = context.supabase;
            staffId = context.staffId;
            bizId = context.bizId;
            useServiceClient = false; // Сотрудник использует обычный клиент с RLS
        }

        // Используем сервисный слой для получения данных
        const result = await getShiftData({
            supabase,
            staffId,
            bizId,
            targetDate,
            useServiceClient,
        });

        // Форматируем ответ в едином формате
        return NextResponse.json({
            ok: true,
            today: result.today,
            bookings: result.bookings,
            services: result.services,
            allShifts: result.allShifts,
            staffPercentMaster: result.staffPercentMaster,
            staffPercentSalon: result.staffPercentSalon,
            hourlyRate: result.hourlyRate,
            currentHoursWorked: result.currentHoursWorked,
            currentGuaranteedAmount: result.currentGuaranteedAmount,
            isDayOff: result.isDayOff,
            stats: result.stats,
        });
    } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        logError('StaffFinance', 'Unexpected error in /api/staff/finance', e);
        
        // Проверяем, не является ли это ошибкой авторизации
        if (e instanceof Error && (e.message === 'UNAUTHORIZED' || e.message === 'NO_STAFF_RECORD' || e.message === 'NO_BIZ_ACCESS')) {
            return NextResponse.json(
                { ok: false, error: 'Unauthorized' },
                { status: 401 }
            );
        }
        
        return NextResponse.json(
            { ok: false, error: msg },
            { status: 500 }
        );
    }
}

