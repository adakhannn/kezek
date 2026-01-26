// apps/web/src/app/api/staff/shift/open/route.ts
import { formatInTimeZone } from 'date-fns-tz';
import { NextResponse } from 'next/server';

import { getStaffContext } from '@/lib/authBiz';
import { logError, logDebug, logWarn } from '@/lib/log';
import { RateLimitConfigs, withRateLimit } from '@/lib/rateLimit';
import { TZ, dateAtTz, todayTz } from '@/lib/time';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * @swagger
 * /api/staff/shift/open:
 *   post:
 *     summary: Открытие смены сотрудника
 *     tags: [Shifts]
 *     security:
 *       - bearerAuth: []
 *       - cookieAuth: []
 *     description: |
 *       Открывает смену для текущего сотрудника на сегодня.
 *       Требования:
 *       - Только сотрудники могут открывать смены
 *       - Не должен быть выходной день
 *       - Не должно быть открытой смены на сегодня
 *     requestBody:
 *       required: false
 *     responses:
 *       '200':
 *         description: Смена успешно открыта
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 ok:
 *                   type: boolean
 *                   example: true
 *                 shift_id:
 *                   type: string
 *                   format: uuid
 *                 date:
 *                   type: string
 *                   format: date
 *                   example: "2024-01-15"
 *       '400':
 *         description: Выходной день или смена уже открыта
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       '403':
 *         description: Нет доступа (не сотрудник)
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
export async function POST(req: Request) {
    // Применяем rate limiting для критичной операции
    return withRateLimit(
        req,
        RateLimitConfigs.critical,
        async () => {
            try {
                const { supabase, staffId, bizId, branchId } = await getStaffContext();

        const now = new Date();
        const ymd = formatInTimeZone(now, TZ, 'yyyy-MM-dd');

        // Проверяем, не выходной ли сегодня
        const baseDate = todayTz();
        const dow = baseDate.getDay(); // 0-6

        // 1. Проверяем staff_time_off (выходные)
        const { data: timeOffs, error: toError } = await supabase
            .from('staff_time_off')
            .select('id, date_from, date_to')
            .eq('biz_id', bizId)
            .eq('staff_id', staffId)
            .lte('date_from', ymd)
            .gte('date_to', ymd);

        if (toError) {
            logWarn('StaffShiftOpen', 'Cannot load staff_time_off', toError);
        }

        if (timeOffs && timeOffs.length > 0) {
            return NextResponse.json(
                { ok: false, error: 'Сегодня у вас выходной день. Нельзя открыть смену.' },
                { status: 400 }
            );
        }

        // 2. Проверяем staff_schedule_rules для конкретной даты (приоритет выше еженедельного)
        const { data: dateRule, error: ruleError } = await supabase
            .from('staff_schedule_rules')
            .select('intervals, is_active')
            .eq('biz_id', bizId)
            .eq('staff_id', staffId)
            .eq('kind', 'date')
            .eq('date_on', ymd)
            .eq('is_active', true)
            .maybeSingle();

        if (ruleError) {
            logWarn('StaffShiftOpen', 'Cannot load staff_schedule_rules', ruleError);
        }

        let hasWorkingHours = false;
        let expectedStart: Date | null = null;

        // Если есть правило на конкретную дату
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
                logWarn('StaffShiftOpen', 'Failed to parse staff_schedule_rules.intervals', e);
            }
        }

        // 3. Если нет правила на дату, проверяем еженедельное расписание
        if (!hasWorkingHours) {
            const { data: whRow, error: whError } = await supabase
                .from('working_hours')
                .select('intervals')
                .eq('biz_id', bizId)
                .eq('staff_id', staffId)
                .eq('day_of_week', dow)
                .maybeSingle();

            if (whError) {
                logWarn('StaffShiftOpen', 'Cannot load working_hours', whError);
            }

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
                logWarn('StaffShiftOpen', 'Failed to parse working_hours.intervals', e);
            }
        }

        // Если нет рабочих часов - это выходной
        if (!hasWorkingHours) {
            return NextResponse.json(
                { ok: false, error: 'Сегодня у вас выходной день. Нельзя открыть смену.' },
                { status: 400 }
            );
        }

        const openedAt = now;
        let lateMinutes = 0;
        if (expectedStart) {
            const diffMs = openedAt.getTime() - expectedStart.getTime();
            if (diffMs > 0) {
                lateMinutes = Math.round(diffMs / 60000);
            }
        }

        // Используем безопасную SQL функцию с защитой от race conditions
        const { data: rpcResult, error: rpcError } = await supabase.rpc('open_staff_shift_safe', {
            p_staff_id: staffId,
            p_biz_id: bizId,
            p_branch_id: branchId,
            p_shift_date: ymd,
            p_opened_at: openedAt.toISOString(),
            p_expected_start: expectedStart ? expectedStart.toISOString() : null,
            p_late_minutes: lateMinutes,
        });

        if (rpcError) {
            logError('StaffShiftOpen', 'Error calling open_staff_shift_safe RPC', rpcError);
            return NextResponse.json(
                { ok: false, error: rpcError.message || 'Не удалось открыть смену' },
                { status: 500 }
            );
        }

        // Проверяем результат RPC
        if (!rpcResult || !rpcResult.ok) {
            const errorMsg = (rpcResult as { error?: string })?.error || 'Не удалось открыть смену';
            logError('StaffShiftOpen', 'RPC returned error', { error: errorMsg, result: rpcResult });
            return NextResponse.json({ ok: false, error: errorMsg }, { status: 500 });
        }

        const shift = (rpcResult as { shift?: unknown }).shift;
        if (!shift) {
            logError('StaffShiftOpen', 'RPC returned ok but no shift data', rpcResult);
            return NextResponse.json({ ok: false, error: 'Не удалось получить данные смены' }, { status: 500 });
        }

        logDebug('StaffShiftOpen', 'Shift opened successfully', {
            action: (rpcResult as { action?: string }).action,
            shiftId: (shift as { id?: string })?.id,
        });

                return NextResponse.json({ ok: true, shift });
            } catch (error) {
                logError('StaffShiftOpen', 'Unexpected error', error);
                const message = error instanceof Error ? error.message : 'Unknown error';
                return NextResponse.json({ ok: false, error: message }, { status: 500 });
            }
        }
    );
}


