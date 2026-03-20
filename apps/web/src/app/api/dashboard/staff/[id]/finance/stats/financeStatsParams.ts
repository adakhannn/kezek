import { formatInTimeZone } from 'date-fns-tz';

import { createErrorResponse } from '@/lib/apiErrorHandler';
import { logError } from '@/lib/log';

export type Period = 'day' | 'month' | 'year';

export type FinanceStatsQuery = {
    period: Period;
    date: string;
    dateFrom: string;
    dateTo: string;
};

export function resolveFinanceStatsQuery(
    req: Request,
    businessTz: string
): FinanceStatsQuery | Response {
    const { searchParams } = new URL(req.url);
    const period = (searchParams.get('period') || 'day') as Period;
    const dateParam = searchParams.get('date');
    let date: string;

    if (dateParam) {
        const validationError = validateDateParam(dateParam, period);
        if (validationError) {
            return validationError;
        }
        date = dateParam;
    } else {
        date = formatInTimeZone(new Date(), businessTz, 'yyyy-MM-dd');
    }

    const { dateFrom, dateTo } = getDateRange(period, date);
    return { period, date, dateFrom, dateTo };
}

function validateDateParam(dateParam: string, period: Period): Response | null {
    if (period === 'day') {
        const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
        if (!dateRegex.test(dateParam)) {
            logError('StaffFinanceStats', 'Invalid date format for day period', { dateParam, period });
            return createErrorResponse('validation', 'Неверный формат даты. Ожидается YYYY-MM-DD для периода "день"', undefined, 400);
        }

        const [year, month, day] = dateParam.split('-').map(Number);
        if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) {
            logError('StaffFinanceStats', 'Invalid date values', { dateParam, year, month, day });
            return createErrorResponse('validation', 'Неверные значения даты', undefined, 400);
        }

        if (year < 1900 || year > 2100 || month < 1 || month > 12 || day < 1 || day > 31) {
            logError('StaffFinanceStats', 'Date out of valid range', { dateParam, year, month, day });
            return createErrorResponse('validation', 'Дата вне допустимого диапазона', undefined, 400);
        }

        const testDate = new Date(year, month - 1, day);
        if (
            testDate.getFullYear() !== year ||
            testDate.getMonth() !== month - 1 ||
            testDate.getDate() !== day
        ) {
            logError('StaffFinanceStats', 'Invalid date (e.g., Feb 30)', { dateParam, year, month, day });
            return createErrorResponse('validation', 'Неверная дата (например, 30 февраля)', undefined, 400);
        }

        return null;
    }

    if (period === 'month') {
        const monthRegex = /^\d{4}-\d{2}$/;
        if (!monthRegex.test(dateParam)) {
            logError('StaffFinanceStats', 'Invalid date format for month period', { dateParam, period });
            return createErrorResponse('validation', 'Неверный формат даты. Ожидается YYYY-MM для периода "месяц"', undefined, 400);
        }

        const [year, month] = dateParam.split('-').map(Number);
        if (!Number.isFinite(year) || !Number.isFinite(month)) {
            logError('StaffFinanceStats', 'Invalid month values', { dateParam, year, month });
            return createErrorResponse('validation', 'Неверные значения месяца', undefined, 400);
        }

        if (year < 1900 || year > 2100 || month < 1 || month > 12) {
            logError('StaffFinanceStats', 'Month out of valid range', { dateParam, year, month });
            return createErrorResponse('validation', 'Месяц вне допустимого диапазона', undefined, 400);
        }

        return null;
    }

    const yearRegex = /^\d{4}$/;
    if (!yearRegex.test(dateParam)) {
        logError('StaffFinanceStats', 'Invalid date format for year period', { dateParam, period });
        return createErrorResponse('validation', 'Неверный формат даты. Ожидается YYYY для периода "год"', undefined, 400);
    }

    const year = Number(dateParam);
    if (!Number.isFinite(year)) {
        logError('StaffFinanceStats', 'Invalid year value', { dateParam, year });
        return createErrorResponse('validation', 'Неверное значение года', undefined, 400);
    }

    if (year < 1900 || year > 2100) {
        logError('StaffFinanceStats', 'Year out of valid range', { dateParam, year });
        return createErrorResponse('validation', 'Год вне допустимого диапазона', undefined, 400);
    }

    return null;
}

function getDateRange(period: Period, date: string) {
    if (period === 'day') {
        return { dateFrom: date, dateTo: date };
    }

    if (period === 'month') {
        const [year, month] = date.split('-');
        const dateFrom = `${year}-${month}-01`;
        const lastDay = new Date(Number(year), Number(month), 0).getDate();
        const dateTo = `${year}-${month}-${String(lastDay).padStart(2, '0')}`;
        return { dateFrom, dateTo };
    }

    const year = date.split('-')[0];
    return {
        dateFrom: `${year}-01-01`,
        dateTo: `${year}-12-31`,
    };
}
