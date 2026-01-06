import { startOfWeek, addDays, addWeeks } from 'date-fns';
import { formatInTimeZone } from 'date-fns-tz';

import { getServiceClient } from './supabaseService';
import { TZ } from './time';

type TimeRange = { start: string; end: string };

/**
 * Инициализирует расписание для нового сотрудника на ближайшие недели
 * @param admin - Supabase admin client
 * @param bizId - ID бизнеса
 * @param staffId - ID сотрудника
 * @param branchId - ID филиала
 * @param weeksAhead - Количество недель вперед для создания расписания (по умолчанию 4)
 */
export async function initializeStaffSchedule(
    admin: ReturnType<typeof getServiceClient>,
    bizId: string,
    staffId: string,
    branchId: string,
    weeksAhead: number = 4
): Promise<void> {
    try {
        const today = new Date();
        const weekStart = startOfWeek(today, { weekStartsOn: 1 }); // Понедельник
        
        // Создаем даты для всех недель вперед
        const allDates: string[] = [];
        for (let weekOffset = 0; weekOffset < weeksAhead; weekOffset++) {
            const targetWeekStart = addWeeks(weekStart, weekOffset);
            const weekDates = Array.from({ length: 7 }, (_, i) => addDays(targetWeekStart, i));
            const dateStrings = weekDates.map((d) => formatInTimeZone(d, TZ, 'yyyy-MM-dd'));
            allDates.push(...dateStrings);
        }

        // Проверяем, какие даты уже есть в расписании
        const startDate = allDates[0];
        const lastDate = allDates[allDates.length - 1];
        const lastDateObj = new Date(lastDate + 'T12:00:00'); // Добавляем время для корректного парсинга
        const endDate = formatInTimeZone(addDays(lastDateObj, 1), TZ, 'yyyy-MM-dd');

        const { data: existingRules } = await admin
            .from('staff_schedule_rules')
            .select('date_on')
            .eq('biz_id', bizId)
            .eq('staff_id', staffId)
            .eq('kind', 'date')
            .eq('is_active', true)
            .gte('date_on', startDate)
            .lt('date_on', endDate);

        const existingDates = new Set((existingRules ?? []).map((r) => r.date_on));
        const missingDates = allDates.filter((d) => !existingDates.has(d));

        if (missingDates.length === 0) {
            // Расписание уже инициализировано
            return;
        }

        // Создаем правила для отсутствующих дней с дефолтным расписанием
        const defaultInterval: TimeRange = { start: '09:00', end: '21:00' };
        const inserts = missingDates.map((date) => ({
            biz_id: bizId,
            staff_id: staffId,
            kind: 'date' as const,
            date_on: date,
            branch_id: branchId,
            tz: TZ,
            intervals: [defaultInterval],
            breaks: [],
            is_active: true,
            priority: 0,
        }));

        // Вставляем все отсутствующие правила
        const { error: insertError } = await admin.from('staff_schedule_rules').insert(inserts);

        if (insertError) {
            console.error('[initializeStaffSchedule] Failed to insert schedule rules:', insertError);
            throw new Error(`Failed to initialize schedule: ${insertError.message}`);
        }

        console.log(`[initializeStaffSchedule] Initialized schedule for staff ${staffId}: ${missingDates.length} days`);
    } catch (error) {
        console.error('[initializeStaffSchedule] Error:', error);
        // Не пробрасываем ошибку дальше, чтобы не сломать создание сотрудника
        // Расписание можно будет создать позже при первом открытии страницы
    }
}

