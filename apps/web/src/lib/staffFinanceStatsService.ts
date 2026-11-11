import { readFinanceReport, readFinanceReportToday, financeReportWorkedHours, type FinanceReport, type ReportClient } from '@/lib/finance/reportSnapshot';
import type { StaffFinanceStatsPeriod, StaffFinanceStatsShiftItem } from '@/lib/finance/types';
import { logDebug, logError } from '@/lib/log';

type StaffFinanceStatsClient = ReportClient;

type StaffFinanceStatsShiftRow = {
    ledger_revision: number; timezone: string; day_start: string; day_end: string; day_hours: number;
    id: string;
    shift_date: string;
    status: 'open' | 'closed';
    opened_at: string | null;
    closed_at: string | null;
    percent_master?: number | null;
    percent_salon?: number | null;
    master_share?: number | null;
    salon_share?: number | null;
    late_minutes?: number | null;
    hours_worked?: number | null;
    hourly_rate?: number | null;
    guaranteed_amount?: number | null;
    total_amount?: number | null;
    consumables_amount?: number | null;
    topup_amount?: number | null;
    staff?: {
        hourly_rate?: number | null;
        percent_master?: number | null;
        percent_salon?: number | null;
    } | null;
};

type StaffFinanceStatsContext = {
    req: Request;
    admin: StaffFinanceStatsClient;
    bizId: string;
    staffId: string;
    staff: {
        full_name: string | null;
    };
};

type StaffFinanceStatsFailure = {
    ok: false;
    status: 400 | 500;
    error: 'validation' | 'internal';
    message: string;
};

type StaffFinanceStatsSuccess = {
    ok: true;
    stats: Record<string, unknown>;
};

export type StaffFinanceStatsResult = StaffFinanceStatsFailure | StaffFinanceStatsSuccess;

export async function runStaffFinanceStats({
    req,
    admin,
    bizId,
    staffId,
    staff,
}: StaffFinanceStatsContext): Promise<StaffFinanceStatsResult> {
    let defaultDate: string | undefined;
    if (!new URL(req.url).searchParams.get('date')) {
        try { defaultDate = await readFinanceReportToday(admin, bizId); }
        catch { return { ok: false, status: 500, error: 'internal', message: 'Не удалось получить бизнес-календарь отчёта' }; }
    }
    const parsed = parseStatsRequest(req, defaultDate);
    if (!parsed.ok) {
        return parsed;
    }

    const { period, date, dateFrom, dateTo } = parsed;

    logDebug('StaffFinanceStats', 'Loading shifts', {
        staffId,
        bizId,
        dateFrom,
        dateTo,
        period,
        date,
    });

    let report: FinanceReport;
    try {
        report = await readFinanceReport(admin, { bizId, staffId, dateFrom, dateTo });
        if (report.shifts.some(row => !Number.isSafeInteger(row.ledger_revision) || typeof row.timezone !== 'string' ||
            !Number.isFinite(row.day_hours) || !Number.isFinite(Date.parse(row.day_start ?? '')) || !Number.isFinite(Date.parse(row.day_end ?? '')))) throw new Error('Неполная версия или календарь финансовой смены');
    }
    catch (error) {
        logError('StaffFinanceStats', 'Failed to read complete shift snapshot', error);
        return { ok: false, status: 500, error: 'internal', message: error instanceof Error ? error.message : 'Не удалось получить финансовую статистику' };
    }
    const finalShifts = report.shifts;
    const shiftItemsMap: Record<string, StaffFinanceStatsShiftItem[]> = Object.fromEntries(finalShifts.map(shift => [shift.id, shift.items]));

    const mappedShifts = finalShifts.map((shift) => mapShiftForStats({ shift, shiftItemsMap }));

    const stats = {
        period,
        dateFrom,
        dateTo,
        staffName: staff.full_name,
        shiftsCount: finalShifts.length,
        openShiftsCount: finalShifts.filter((shift) => shift.status === 'open').length,
        closedShiftsCount: finalShifts.filter((shift) => shift.status === 'closed').length,
        totalAmount: 0,
        totalMaster: 0,
        totalSalon: 0,
        totalConsumables: 0,
        totalLateMinutes: 0,
        totalClients: Object.values(shiftItemsMap).reduce((sum, items) => sum + items.length, 0),
        totalBaseMasterShare: 0,
        totalBaseSalonShare: 0,
        totalGuaranteedAmount: 0,
        totalTopupAmount: 0,
        hasGuaranteedPayment: false,
        shifts: mappedShifts,
    };

    for (const shift of mappedShifts) {
        stats.totalAmount += shift.total_amount;
        stats.totalMaster += shift.master_share;
        stats.totalSalon += shift.salon_share;
        stats.totalConsumables += shift.consumables_amount;
        stats.totalLateMinutes += shift.late_minutes;
        stats.totalBaseMasterShare += shift.base_master_share;
        stats.totalBaseSalonShare += shift.base_salon_share;
        stats.totalGuaranteedAmount += shift.guaranteed_amount;
        stats.totalTopupAmount += shift.topup_amount;
        stats.hasGuaranteedPayment ||= shift.topup_amount > 0;
    }

    return {
        ok: true,
        stats,
    };
}

function parseStatsRequest(req: Request, defaultDate?: string):
    | (StaffFinanceStatsFailure & { ok: false })
    | {
          ok: true;
          period: StaffFinanceStatsPeriod;
          date: string;
          dateFrom: string;
          dateTo: string;
      } {
    const { searchParams } = new URL(req.url);
    const period = normalizePeriod(searchParams.get('period'));
    const dateParam = searchParams.get('date');
    const date = dateParam ? validatePeriodDate(period, dateParam) : defaultDate ?? validationFailure('Нет даты бизнес-календаря');

    if (typeof date !== 'string') {
        return date;
    }

    if (period === 'day') {
        return { ok: true, period, date, dateFrom: date, dateTo: date };
    }

    if (period === 'month') {
        const [year, month] = date.split('-');
        const lastDay = new Date(Number(year), Number(month), 0).getDate();
        return {
            ok: true,
            period,
            date,
            dateFrom: `${year}-${month}-01`,
            dateTo: `${year}-${month}-${String(lastDay).padStart(2, '0')}`,
        };
    }

    const year = date.split('-')[0];
    return {
        ok: true,
        period,
        date,
        dateFrom: `${year}-01-01`,
        dateTo: `${year}-12-31`,
    };
}

function normalizePeriod(value: string | null): StaffFinanceStatsPeriod {
    return value === 'month' || value === 'year' ? value : 'day';
}

function validatePeriodDate(
    period: StaffFinanceStatsPeriod,
    dateParam: string,
): string | StaffFinanceStatsFailure {
    if (period === 'day') {
        if (!/^\d{4}-\d{2}-\d{2}$/.test(dateParam)) {
            return validationFailure('Неверный формат даты. Ожидается YYYY-MM-DD для периода "день"');
        }

        const [year, month, day] = dateParam.split('-').map(Number);
        if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) {
            return validationFailure('Неверные значения даты');
        }

        if (year < 1900 || year > 2100 || month < 1 || month > 12 || day < 1 || day > 31) {
            return validationFailure('Дата вне допустимого диапазона');
        }

        const testDate = new Date(year, month - 1, day);
        if (
            testDate.getFullYear() !== year ||
            testDate.getMonth() !== month - 1 ||
            testDate.getDate() !== day
        ) {
            return validationFailure('Неверная дата (например, 30 февраля)');
        }

        return dateParam;
    }

    if (period === 'month') {
        if (!/^\d{4}-\d{2}$/.test(dateParam)) {
            return validationFailure('Неверный формат даты. Ожидается YYYY-MM для периода "месяц"');
        }

        const [year, month] = dateParam.split('-').map(Number);
        if (!Number.isFinite(year) || !Number.isFinite(month)) {
            return validationFailure('Неверные значения месяца');
        }

        if (year < 1900 || year > 2100 || month < 1 || month > 12) {
            return validationFailure('Месяц вне допустимого диапазона');
        }

        return dateParam;
    }

    if (!/^\d{4}$/.test(dateParam)) {
        return validationFailure('Неверный формат даты. Ожидается YYYY для периода "год"');
    }

    const year = Number(dateParam);
    if (!Number.isFinite(year)) {
        return validationFailure('Неверное значение года');
    }

    if (year < 1900 || year > 2100) {
        return validationFailure('Год вне допустимого диапазона');
    }

    return dateParam;
}

function validationFailure(message: string): StaffFinanceStatsFailure {
    return {
        ok: false,
        status: 400,
        error: 'validation',
        message,
    };
}

function mapShiftForStats({
    shift,
    shiftItemsMap,
}: {
    shift: StaffFinanceStatsShiftRow;
    shiftItemsMap: Record<string, StaffFinanceStatsShiftItem[]>;
}) {
    const shiftItems = shiftItemsMap[shift.id] || [];
    const ledgerAmount = shiftItems.reduce((sum, item) => sum + item.service_amount, 0);
    const ledgerConsumables = shiftItems.reduce((sum, item) => sum + item.consumables_amount, 0);
    const shiftTotalAmount = shift.status === 'closed' ? Number(shift.total_amount ?? ledgerAmount) : ledgerAmount;
    const shiftConsumables = shift.status === 'closed' ? Number(shift.consumables_amount ?? ledgerConsumables) : ledgerConsumables;
    const staffData = (shift as {
        staff?: { hourly_rate?: number | null; percent_master?: number | null; percent_salon?: number | null } | null;
    }).staff;
    const hourlyRate = shift.status === 'closed' ? (shift.hourly_rate == null ? null : Number(shift.hourly_rate))
        : shift.hourly_rate != null ? Number(shift.hourly_rate) : staffData?.hourly_rate != null ? Number(staffData.hourly_rate) : null;
    const staffPercentMaster = shift.status === 'open' && staffData?.percent_master != null ? Number(staffData.percent_master) : null;
    const staffPercentSalon = shift.status === 'open' && staffData?.percent_salon != null ? Number(staffData.percent_salon) : null;
    const shiftPercentMaster = Number(shift.percent_master ?? staffPercentMaster ?? 60);
    const shiftPercentSalon = Number(shift.percent_salon ?? staffPercentSalon ?? 40);
    const percentSum = shiftPercentMaster + shiftPercentSalon || 100;
    const normalizedMaster = (shiftPercentMaster / percentSum) * 100;
    const baseMasterShare = Math.round((shiftTotalAmount * normalizedMaster) / 100);
    const baseSalonShare = shiftTotalAmount - baseMasterShare + shiftConsumables;

    const workedHours = financeReportWorkedHours({ opened_at: shift.opened_at, day_start: shift.day_start, day_end: shift.day_end });
    let displayMasterShare = Number(shift.master_share ?? 0);
    let displaySalonShare = Number(shift.salon_share ?? 0);

    if (shift.status === 'open') {
        if (hourlyRate && workedHours !== null) {
            const guaranteedAmount = Math.round(workedHours * hourlyRate * 100) / 100;
            if (guaranteedAmount > baseMasterShare) {
                displayMasterShare = guaranteedAmount;
                displaySalonShare = Math.max(0, baseSalonShare - (displayMasterShare - baseMasterShare));
            } else {
                displayMasterShare = baseMasterShare;
                displaySalonShare = baseSalonShare;
            }
        } else {
            displayMasterShare = baseMasterShare;
            displaySalonShare = baseSalonShare;
        }
    }

    let displayGuaranteedAmount = Number(shift.guaranteed_amount ?? 0);
    let displayHoursWorked: number | null = shift.hours_worked == null ? null : Number(shift.hours_worked);
    if (shift.status === 'open' && hourlyRate) {
        displayHoursWorked = workedHours;
        displayGuaranteedAmount = workedHours === null ? 0 : Math.round(workedHours * hourlyRate * 100) / 100;
    }

    return {
        id: shift.id,
        ledger_revision: shift.ledger_revision, timezone: shift.timezone, day_hours: shift.day_hours,
        shift_date: shift.shift_date,
        status: shift.status,
        opened_at: shift.opened_at,
        closed_at: shift.closed_at,
        total_amount: shiftTotalAmount,
        consumables_amount: shiftConsumables,
        base_master_share: baseMasterShare,
        base_salon_share: baseSalonShare,
        master_share: displayMasterShare,
        salon_share: displaySalonShare,
        late_minutes: Number(shift.late_minutes ?? 0),
        hours_worked: displayHoursWorked,
        hourly_rate: hourlyRate,
        guaranteed_amount: displayGuaranteedAmount,
        topup_amount: shift.status === 'closed' && shift.topup_amount != null ? Number(shift.topup_amount)
            : Math.max(0, Math.round((displayGuaranteedAmount - baseMasterShare) * 100) / 100),
        items: shiftItems.map((item) => ({
            id: item.id,
            client_name: item.client_name || '',
            service_name: item.service_name || '',
            service_amount: item.service_amount,
            consumables_amount: item.consumables_amount,
            note: item.note || null,
            booking_id: item.booking_id || null,
            created_at: item.created_at ?? null,
        })),
    };
}

