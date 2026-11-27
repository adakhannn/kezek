import { formatInTimeZone } from 'date-fns-tz';

import { loadBusinessTimeZone } from './businessTimeZone';
import { logDebug, logError } from './log';
import { addDaysYmd, businessWeekYmds } from './scheduling/businessWeek';
import { branchDayIntervals, LEGACY_DEFAULT_INTERVAL, type BranchHoursRow } from './scheduling/legacyDefaults';
import { getServiceClient } from './supabaseService';

/**
 * Инициализирует расписание для сотрудника на текущую и следующую недели (старая модель).
 * Функция идемпотентна: создаёт только отсутствующие дни, начиная с сегодняшнего. Часы берутся из
 * основного филиала; закрытый день филиала становится выходным. 09:00–21:00 ставится, только если
 * у филиала вообще не заданы часы (FE-02).
 * @param admin - Supabase admin client
 * @param bizId - ID бизнеса
 * @param staffId - ID сотрудника
 * @param branchId - ID филиала
 * @returns Объект с информацией о результате инициализации
 */
export async function initializeStaffSchedule(
    admin: ReturnType<typeof getServiceClient>,
    bizId: string,
    staffId: string,
    branchId: string
): Promise<{ success: boolean; daysCreated: number; error?: string }> {
    try {
        logDebug('StaffSchedule', 'Starting initialization', { staffId, bizId, branchId });
        // Days and the rule tz are the business calendar (ARCH-11).
        const tz = await loadBusinessTimeZone(bizId, admin);
        
        const today = new Date();

        // Даты текущей (0) и следующей (1) недель бизнеса: неделя считается в его поясе, а не в поясе сервера.
        const allDates = [...businessWeekYmds(0, tz, today), ...businessWeekYmds(1, tz, today)];
        const todayYmd = formatInTimeZone(today, tz, 'yyyy-MM-dd');
        const futureDates = allDates.filter((date) => date >= todayYmd);

        logDebug('StaffSchedule', 'Generated dates', { count: allDates.length, first: allDates[0], last: allDates[allDates.length - 1] });

        // Проверяем, какие даты уже есть в расписании
        const startDate = allDates[0];
        const lastDate = allDates[allDates.length - 1];
        const endDate = addDaysYmd(lastDate, 1);

        const { data: existingRules, error: selectError } = await admin
            .from('staff_schedule_rules')
            .select('date_on')
            .eq('biz_id', bizId)
            .eq('staff_id', staffId)
            .eq('kind', 'date')
            .eq('is_active', true)
            .gte('date_on', startDate)
            .lt('date_on', endDate);

        if (selectError) {
            logError('StaffSchedule', 'Failed to check existing rules', selectError);
            throw new Error(`Failed to check existing schedule: ${selectError.message}`);
        }

        const existingDates = new Set((existingRules ?? []).map((r: { date_on: string | null }) => r.date_on).filter((d): d is string => d !== null));
        const missingDates = futureDates.filter((d) => !existingDates.has(d));

        logDebug('StaffSchedule', 'Found existing and missing dates', { existing: existingDates.size, missing: missingDates.length });

        if (missingDates.length === 0) {
            // Расписание уже инициализировано
            logDebug('StaffSchedule', 'Schedule already initialized', { staffId });
            return { success: true, daysCreated: 0 };
        }

        // Загружаем расписание филиала
        const { data: branchSchedule, error: branchError } = await admin
            .from('branch_working_hours')
            .select('day_of_week, intervals')
            .eq('biz_id', bizId)
            .eq('branch_id', branchId);

        if (branchError) {
            logError('StaffSchedule', 'Failed to read branch hours', branchError);
            throw new Error(`Failed to read branch hours: ${branchError.message}`);
        }
        const branchRows: BranchHoursRow[] = (branchSchedule ?? []).map((row) => ({
            day_of_week: row.day_of_week,
            intervals: Array.isArray(row.intervals) ? (row.intervals as BranchHoursRow['intervals']) : [],
        }));

        // Правила для отсутствующих дней по часам филиала: закрытый день — выходной ([]).
        const inserts = missingDates.map((date) => {
            const intervals = branchDayIntervals(branchRows, date) ?? [LEGACY_DEFAULT_INTERVAL];

            return {
                biz_id: bizId,
                staff_id: staffId,
                kind: 'date' as const,
                date_on: date,
                branch_id: branchId,
                tz,
                intervals,
                breaks: [],
                is_active: true,
                priority: 0,
            };
        });

        logDebug('StaffSchedule', 'Inserting schedule rules', { count: inserts.length });

        // Вставляем все отсутствующие правила
        const { data: insertedData, error: insertError } = await admin.from('staff_schedule_rules').insert(inserts).select('id');

        if (insertError) {
            logError('StaffSchedule', 'Failed to insert schedule rules', insertError);
            throw new Error(`Failed to initialize schedule: ${insertError.message}`);
        }

        const daysCreated = insertedData?.length || missingDates.length;
        logDebug('StaffSchedule', 'Successfully initialized schedule', { staffId, daysCreated });
        return { success: true, daysCreated };
    } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        logError('StaffSchedule', 'Error during initialization', { staffId, error: errorMsg, originalError: error });
        // Не пробрасываем ошибку дальше, чтобы не сломать создание сотрудника.
        // Расписание задаётся в редакторе: «Применить часы филиала» или сохранение дня.
        // The response carries a code, not the database text (ENG-47); the cause is logged above.
        return { success: false, daysCreated: 0, error: 'schedule_init_failed' };
    }
}

