// apps/web/src/app/api/staff/shift/open/route.ts
import { formatInTimeZone } from 'date-fns-tz';
import { NextResponse } from 'next/server';

import { getStaffContext } from '@/lib/authBiz';
import { TZ, dateAtTz, todayTz } from '@/lib/time';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST() {
    try {
        const { supabase, staffId, bizId, branchId } = await getStaffContext();

        const now = new Date();
        const ymd = formatInTimeZone(now, TZ, 'yyyy-MM-dd');

        // Проверяем, есть ли уже смена на сегодня
        const { data: existing, error: loadError } = await supabase
            .from('staff_shifts')
            .select('*')
            .eq('staff_id', staffId)
            .eq('shift_date', ymd)
            .maybeSingle();

        if (loadError) {
            console.error('Error loading existing shift:', loadError);
            return NextResponse.json({ ok: false, error: loadError.message }, { status: 500 });
        }

        if (existing) {
            if (existing.status === 'open') {
                // Уже открыта — просто возвращаем
                return NextResponse.json({ ok: true, shift: existing });
            }

            // Смена была закрыта, но сотрудник хочет её переоткрыть.
            // Логика: сохраняем первое время открытия и опоздание (opened_at / late_minutes),
            // очищаем финансы и closed_at, переводим статус обратно в open.
            const { data: reopened, error: reopenError } = await supabase
                .from('staff_shifts')
                .update({
                    status: 'open',
                    closed_at: null,
                    total_amount: 0,
                    consumables_amount: 0,
                    master_share: 0,
                    salon_share: 0,
                })
                .eq('id', existing.id)
                .select('*')
                .maybeSingle();

            if (reopenError || !reopened) {
                console.error('Error reopening shift:', reopenError);
                return NextResponse.json(
                    { ok: false, error: reopenError?.message || 'Не удалось переоткрыть смену' },
                    { status: 500 }
                );
            }

            return NextResponse.json({ ok: true, shift: reopened });
        }

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
            console.warn('Cannot load staff_time_off for shift open:', toError.message);
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
            console.warn('Cannot load staff_schedule_rules for shift open:', ruleError.message);
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
                console.warn('Failed to parse staff_schedule_rules.intervals for shift open:', e);
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
                console.warn('Cannot load working_hours for shift open:', whError.message);
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
                console.warn('Failed to parse working_hours.intervals for shift open:', e);
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

        const insertPayload = {
            staff_id: staffId,
            biz_id: bizId,
            branch_id: branchId,
            shift_date: ymd,
            opened_at: openedAt.toISOString(),
            expected_start: expectedStart ? expectedStart.toISOString() : null,
            late_minutes: lateMinutes,
            status: 'open' as const,
        };

        const { data: inserted, error: insertError } = await supabase
            .from('staff_shifts')
            .insert(insertPayload)
            .select('*')
            .maybeSingle();

        if (insertError || !inserted) {
            console.error('Error opening shift:', insertError);
            return NextResponse.json(
                { ok: false, error: insertError?.message || 'Не удалось открыть смену' },
                { status: 500 }
            );
        }

        return NextResponse.json({ ok: true, shift: inserted });
    } catch (error) {
        console.error('Unexpected error in /api/staff/shift/open:', error);
        const message = error instanceof Error ? error.message : 'Unknown error';
        return NextResponse.json({ ok: false, error: message }, { status: 500 });
    }
}


