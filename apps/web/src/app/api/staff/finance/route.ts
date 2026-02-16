/**
 * Единый API endpoint для получения данных смены сотрудника
 * Поддерживает как сотрудников (через getStaffContext), так и менеджеров (через getBizContextForManagers)
 * 
 * Query параметры:
 * - staffId (опционально) - ID сотрудника (для менеджеров)
 * - date (опционально) - дата в формате YYYY-MM-DD (по умолчанию сегодня)
 */

import type { SupabaseClient } from '@supabase/supabase-js';

import { getShiftData } from '@/app/staff/finance/services/shiftDataService';
import { withErrorHandler, createErrorResponse, createSuccessResponse } from '@/lib/apiErrorHandler';
import { logApiMetric, getIpAddress, determineErrorType } from '@/lib/apiMetrics';
import { getBizContextForManagers, getStaffContext } from '@/lib/authBiz';
import { logError, logDebug } from '@/lib/log';
import { validateQuery } from '@/lib/validation/apiValidation';
import { staffFinanceQuerySchema } from '@/lib/validation/schemas';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(req: Request) {
    const startTime = Date.now();
    const endpoint = '/api/staff/finance';
    let statusCode = 500;
    let staffId: string | undefined;
    let bizId: string | undefined;
    let userId: string | undefined;
    let errorMessage: string | undefined;
    
    try {
        return await withErrorHandler('StaffFinance', async () => {
        // Валидация query параметров
        const url = new URL(req.url);
        const queryValidation = validateQuery(url, staffFinanceQuerySchema);
        if (!queryValidation.success) {
            statusCode = 400;
            errorMessage = 'Invalid query parameters';
            return queryValidation.response;
        }
        const { staffId: staffIdParam, date: dateParam } = queryValidation.data;

        // Определяем целевую дату
        let targetDate: Date;
        if (dateParam) {
            // Парсим дату из параметра (формат YYYY-MM-DD, уже валидирован)
            const [year, month, day] = dateParam.split('-').map(Number);
            targetDate = new Date(year, month - 1, day);
        } else {
            targetDate = new Date();
        }

        let staffId: string;
        let bizId: string;
        // Используем общий тип SupabaseClient, который совместим с обоими клиентами
        let supabase: SupabaseClient;
        let useServiceClient = false;

        // Если передан staffId, это запрос от менеджера/владельца
        if (staffIdParam) {
            const context = await getBizContextForManagers();
            supabase = context.supabase;
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
                return createErrorResponse('not_found', 'Сотрудник не найден или доступ запрещен', undefined, 404);
            }

            if (!staff) {
                logDebug('StaffFinance', 'Staff not found', { staffId: staffIdParam, bizId });
                return createErrorResponse('not_found', 'Сотрудник не найден или доступ запрещен', undefined, 404);
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
                return createErrorResponse('not_found', 'Сотрудник не найден или доступ запрещен', undefined, 404);
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
            // Получаем user_id из сессии для логирования
            const { data: { user } } = await supabase.auth.getUser();
            userId = user?.id;
        }

        // Используем сервисный слой для получения данных
        const result = await getShiftData({
            supabase,
            staffId,
            bizId,
            targetDate,
            useServiceClient,
        });

        // Преобразуем items из snake_case в camelCase
        const items = (result.today.items || []).map((item: {
            id: string;
            client_name: string | null;
            service_name: string | null;
            service_amount: number;
            consumables_amount: number;
            note: string | null;
            booking_id: string | null;
            created_at: string;
        }) => ({
            id: item.id,
            clientName: item.client_name || '',
            serviceName: item.service_name || '',
            serviceAmount: item.service_amount || 0,
            consumablesAmount: item.consumables_amount || 0,
            bookingId: item.booking_id || null,
            createdAt: item.created_at || null,
        }));

        // Форматируем ответ в едином формате
        const responseData = {
            today: {
                ...result.today,
                items,
            },
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
        };
        
        statusCode = 200;
        
        // Логируем метрику асинхронно (не блокируем ответ)
        logApiMetric({
            endpoint,
            method: 'GET',
            statusCode,
            durationMs: Date.now() - startTime,
            userId,
            staffId,
            bizId,
            ipAddress: getIpAddress(req),
            userAgent: req.headers.get('user-agent') || undefined,
        }).catch(() => {
            // Игнорируем ошибки логирования
        });
        
            return createSuccessResponse(responseData);
        });
    } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        logError('StaffFinance', 'Unexpected error in /api/staff/finance', e);
        
        errorMessage = msg;
        
        // Проверяем, не является ли это ошибкой авторизации
        if (e instanceof Error && (e.message === 'UNAUTHORIZED' || e.message === 'NO_STAFF_RECORD' || e.message === 'NO_BIZ_ACCESS')) {
            statusCode = 401;
        } else {
            statusCode = 500;
        }
        
        // Логируем метрику с ошибкой
        logApiMetric({
            endpoint,
            method: 'GET',
            statusCode,
            durationMs: Date.now() - startTime,
            userId,
            staffId,
            bizId,
            errorMessage,
            errorType: determineErrorType(statusCode, errorMessage) || undefined,
            ipAddress: getIpAddress(req),
            userAgent: req.headers.get('user-agent') || undefined,
        }).catch(() => {
            // Игнорируем ошибки логирования
        });
        
        // Возвращаем ошибку через withErrorHandler
        return createErrorResponse(
            statusCode === 401 ? 'auth' : 'internal',
            msg,
            undefined,
            statusCode
        );
    }
}

