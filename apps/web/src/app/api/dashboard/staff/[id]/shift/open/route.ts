// apps/web/src/app/api/dashboard/staff/[id]/shift/open/route.ts
import { withErrorHandler, createErrorResponse, createSuccessResponse } from '@/lib/apiErrorHandler';
import { logError, logDebug } from '@/lib/log';
import { RateLimitConfigs, withRateLimit } from '@/lib/rateLimit';
import { TZ, dateAtTz, formatDateInTz } from '@/lib/time';
import { withManagerAndStaffContext } from '@/lib/withManagerAndStaffContext';

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
                return withManagerAndStaffContext<{ id: string; biz_id: string | number | null; branch_id: string | null }>(
                    req,
                    context,
                    { scope: 'OwnerShiftOpen', staffIdParamName: 'id', staffSelect: 'id, biz_id, branch_id' },
                    async ({ supabase, admin, bizId, staffId, staff }) => {
                // Получаем дату из query параметров или используем сегодня
                const { searchParams } = new URL(req.url);
                const dateParam = searchParams.get('date');
                const targetDate = dateParam 
                    ? new Date(dateParam + 'T00:00:00')
                    : new Date();
                const ymd = formatDateInTz(targetDate, TZ);

                // staff_shifts.branch_id NOT NULL — у сотрудника должен быть указан филиал
                if (staff.branch_id == null) {
                    logDebug('OwnerShiftOpen', 'Staff has no branch_id', { staffId, bizId });
                    return createErrorResponse('validation', 'У сотрудника не указан филиал. Укажите филиал в карточке сотрудника и попробуйте снова.', undefined, 400);
                }

                // Проверяем, не открыта ли уже смена за эту дату
                const { data: existingShift, error: checkError } = await admin
                    .from('staff_shifts')
                    .select('id, status')
                    .eq('staff_id', staffId)
                    .eq('shift_date', ymd)
                    .maybeSingle();

                if (checkError) {
                    logError('OwnerShiftOpen', 'Error checking existing shift', checkError);
                    return createErrorResponse('internal', 'Не удалось проверить существующую смену', undefined, 500);
                }

                if (existingShift?.status === 'open') {
                    // Делаем операцию идемпотентной для владельца:
                    // если смена уже открыта, просто возвращаем успешный ответ,
                    // чтобы UI не падал с ошибкой в случае повторных кликов.
                    logDebug('OwnerShiftOpen', 'Shift already open, returning existing shift', {
                        shiftId: existingShift.id,
                        staffId,
                        ymd,
                    });
                    return createSuccessResponse({ shift: existingShift });
                }
                // existingShift со статусом 'closed' или другим — переоткрываем через UPDATE ниже

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

                // Если смена уже существует (закрыта или в другом состоянии) — переоткрываем
                if (existingShift) {
                    const { data: updatedShift, error: updateError } = await admin
                        .from('staff_shifts')
                        .update({
                            status: 'open',
                            opened_at: openedAt.toISOString(),
                            closed_at: null,
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
                const { data: newShift, error: createError } = await admin
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
                    const errorPayload = {
                        code: (createError as { code?: string })?.code,
                        message: (createError as { message?: string })?.message,
                        details: (createError as { details?: string })?.details,
                        hint: (createError as { hint?: string })?.hint,
                        staffId,
                        bizId,
                        branch_id: staff.branch_id,
                        shift_date: ymd,
                    };
                    logError('OwnerShiftOpen', 'Error creating shift', errorPayload);
                    // В дев-окружении полезнее вернуть реальное сообщение БД, чтобы понять причину:
                    // например, нарушение RLS или constraint.
                    const humanMessage =
                        (createError as { message?: string })?.message ||
                        'Не удалось создать смену';
                    return createErrorResponse('internal', humanMessage, errorPayload, 500);
                }

                logDebug('OwnerShiftOpen', 'Shift opened successfully', {
                    shiftId: newShift.id,
                    staffId,
                    ymd,
                });

                return createSuccessResponse({ shift: newShift });
                },
                );
            });
        }
    );
}

