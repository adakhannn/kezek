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

        if (existing && existing.status === 'closed') {
            return NextResponse.json(
                { ok: false, error: 'Смена за сегодня уже закрыта' },
                { status: 400 }
            );
        }

        if (existing && existing.status === 'open') {
            // Просто возвращаем текущую открытую смену
            return NextResponse.json({ ok: true, shift: existing });
        }

        // Определяем ожидаемое время начала смены по расписанию
        const baseDate = todayTz();
        const dow = baseDate.getDay(); // 0-6

        let expectedStart: Date | null = null;

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
                const sorted = [...intervals].sort((a, b) => (a.start ?? '').localeCompare(b.start ?? ''));
                const first = sorted[0];
                if (first?.start) {
                    expectedStart = dateAtTz(ymd, first.start);
                }
            }
        } catch (e) {
            console.warn('Failed to parse working_hours.intervals for shift open:', e);
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


