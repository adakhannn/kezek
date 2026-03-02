// apps/web/src/app/api/dashboard/staff/[id]/shift/open/route.ts
import { formatInTimeZone } from 'date-fns-tz';

import { withErrorHandler, createErrorResponse, createSuccessResponse } from '@/lib/apiErrorHandler';
import { getBizContextForManagers } from '@/lib/authBiz';
import { logError, logDebug } from '@/lib/log';
import { RateLimitConfigs, withRateLimit } from '@/lib/rateLimit';
import { getRouteParamUuid } from '@/lib/routeParams';
import { getServiceClient } from '@/lib/supabaseService';
import { TZ, dateAtTz } from '@/lib/time';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * POST - Открыть смену для сотрудника (для владельца/менеджера)
 */
export async function POST(
    req: Request,
    context: unknown
) {
    return withRateLimit(
        req,
        RateLimitConfigs.critical,
        async () => {
            return withErrorHandler('OwnerShiftOpen', async () => {
                // Валидация UUID для предотвращения потенциальных проблем безопасности
                const staffId = await getRouteParamUuid(context, 'id');
                const { supabase, bizId } = await getBizContextForManagers();

                // Получаем дату из query параметров или используем сегодня
                const { searchParams } = new URL(req.url);
                const dateParam = searchParams.get('date');
                const targetDate = dateParam 
                    ? new Date(dateParam + 'T00:00:00')
                    : new Date();
                const ymd = formatInTimeZone(targetDate, TZ, 'yyyy-MM-dd');

                // Проверяем, что сотрудник принадлежит этому бизнесу
                const { data: staff, error: staffError } = await supabase
                    .from('staff')
                    .select('id, biz_id, branch_id')
                    .eq('id', staffId)
                    .maybeSingle();

                if (staffError) {
                    logError('OwnerShiftOpen', 'Error loading staff', { 
                        error: staffError.message, 
                        staffId,
                        bizId 
                    });
                    return createErrorResponse('internal', 'Не удалось загрузить данные сотрудника', undefined, 500);
                }

                if (!staff) {
                    return createErrorResponse('not_found', 'Сотрудник не найден', undefined, 404);
                }

                // Нормализуем значения для надежного сравнения
                const normalizedBizId = bizId ? String(bizId).trim() : null;
                const normalizedStaffBizId = staff.biz_id != null ? String(staff.biz_id).trim() : null;

                // Проверяем принадлежность к бизнесу
                if (!normalizedStaffBizId || !normalizedBizId || normalizedStaffBizId !== normalizedBizId) {
                    logError('OwnerShiftOpen', 'Staff business mismatch', {
                        staffId,
                        staffBizId: normalizedStaffBizId,
                        requestedBizId: normalizedBizId,
                    });
                    return createErrorResponse('forbidden', 'Сотрудник не принадлежит этому бизнесу', undefined, 403);
                }

                // Проверяем, не открыта ли уже смена за эту дату
                const { data: existingShift, error: checkError } = await supabase
                    .from('staff_shifts')
                    .select('id, status')
                    .eq('staff_id', staffId)
                    .eq('shift_date', ymd)
                    .maybeSingle();

                if (checkError) {
                    logError('OwnerShiftOpen', 'Error checking existing shift', checkError);
                    return createErrorResponse('internal', 'Не удалось проверить существующую смену', undefined, 500);
                }

                if (existingShift) {
                    if (existingShift.status === 'open') {
                        return createErrorResponse('validation', 'Смена уже открыта', undefined, 400);
                    }
                    if (existingShift.status === 'closed') {
                        return createErrorResponse('validation', 'Смена уже закрыта. Используйте функцию переоткрытия.', undefined, 400);
                    }
                }

                // Получаем информацию о расписании для расчета опоздания
                const dow = targetDate.getDay(); // 0-6
                let expectedStart: Date | null = null;

                // Проверяем правило на конкретную дату
                const { data: dateRule } = await supabase
                    .from('staff_schedule_rules')
                    .select('intervals, is_active')
                    .eq('biz_id', bizId)
                    .eq('staff_id', staffId)
                    .eq('kind', 'date')
                    .eq('date_on', ymd)
                    .eq('is_active', true)
                    .maybeSingle();

                let hasWorkingHours = false;

                if (dateRule && dateRule.is_active) {
                    try {
                        const intervals = (dateRule.intervals ?? []) as { start: string; end: string }[];
                        if (Array.isArray(intervals) && intervals.length > 0) {
                            hasWorkingHours = true;
                            const sorted = [...intervals].sort((a, b) => (a.start ?? '').localeCompare(b.start ?? ''));
                            const first = sorted[0];
                            if (first?.start) {
                                expectedStart = dateAtTz(ymd, first.start);
                            }
                        }
                    } catch (e) {
                        logError('OwnerShiftOpen', 'Failed to parse date rule intervals', e);
                    }
                }

                // Если нет правила на дату, проверяем еженедельное расписание
                if (!hasWorkingHours) {
                    const { data: whRow } = await supabase
                        .from('working_hours')
                        .select('intervals')
                        .eq('biz_id', bizId)
                        .eq('staff_id', staffId)
                        .eq('day_of_week', dow)
                        .maybeSingle();

                    try {
                        const intervals = (whRow?.intervals ?? []) as { start: string; end: string }[];
                        if (Array.isArray(intervals) && intervals.length > 0) {
                            hasWorkingHours = true;
                            const sorted = [...intervals].sort((a, b) => (a.start ?? '').localeCompare(b.start ?? ''));
                            const first = sorted[0];
                            if (first?.start) {
                                expectedStart = dateAtTz(ymd, first.start);
                            }
                        }
                    } catch (e) {
                        logError('OwnerShiftOpen', 'Failed to parse working hours intervals', e);
                    }
                }

                const now = new Date();
                const openedAt = now;
                let lateMinutes = 0;
                if (expectedStart) {
                    const diffMs = openedAt.getTime() - expectedStart.getTime();
                    if (diffMs > 0) {
                        lateMinutes = Math.round(diffMs / 60000);
                    }
                }

                // Используем service client для создания смены
                const writeClient = getServiceClient();

                // Если смена уже существует (но не открыта и не закрыта), обновляем её
                if (existingShift) {
                    const { data: updatedShift, error: updateError } = await writeClient
                        .from('staff_shifts')
                        .update({
                            status: 'open',
                            opened_at: openedAt.toISOString(),
                            late_minutes: lateMinutes,
                        })
                        .eq('id', existingShift.id)
                        .select()
                        .single();

                    if (updateError) {
                        logError('OwnerShiftOpen', 'Error updating shift', updateError);
                        return createErrorResponse('internal', 'Не удалось открыть смену', undefined, 500);
                    }

                    logDebug('OwnerShiftOpen', 'Shift reopened successfully', {
                        shiftId: updatedShift.id,
                        staffId,
                        ymd,
                    });

                    return createSuccessResponse({ shift: updatedShift });
                }

                // Создаем новую смену
                const { data: newShift, error: createError } = await writeClient
                    .from('staff_shifts')
                    .insert({
                        staff_id: staffId,
                        biz_id: bizId,
                        branch_id: staff.branch_id,
                        shift_date: ymd,
                        status: 'open',
                        opened_at: openedAt.toISOString(),
                        late_minutes: lateMinutes,
                    })
                    .select()
                    .single();

                if (createError) {
                    logError('OwnerShiftOpen', 'Error creating shift', createError);
                    return createErrorResponse('internal', 'Не удалось создать смену', undefined, 500);
                }

                logDebug('OwnerShiftOpen', 'Shift opened successfully', {
                    shiftId: newShift.id,
                    staffId,
                    ymd,
                });

                return createSuccessResponse({ shift: newShift });
            });
        }
    );
}

