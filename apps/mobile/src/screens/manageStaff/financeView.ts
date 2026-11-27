import {
    calculateBaseShares,
    calculateDisplayShares,
    calculateTotalConsumables,
    calculateTotalServiceAmount,
} from '@core-domain/finance';

import type { Locale } from '../../i18n/locale';
import { formatNumber } from '../../utils/format';
import type { WireShiftItem } from './api';
import type {
    FinanceBooking,
    FinanceServiceName,
    ManagedShift,
    ManagedShiftItem,
    StaffFinanceStatsPayload,
    StaffFinanceStatsPeriod,
    StaffFinanceStatsShift,
} from './types';

/**
 * Display of the manager's finance pages. Every figure comes from the server's ledger or from the
 * shared finance domain (@core-domain/finance), exactly as the website's useShiftCalculations and
 * StaffFinanceStatsSections compute it: a closed shift shows its stored shares, an open shift the
 * live split with the guarantee; period totals are the stats API's own totals.
 */

export type ShiftCalculations = {
    totalAmount: number;
    totalConsumables: number;
    masterShare: number;
    salonShare: number;
    displayTotalAmount: number;
};

export function shiftCalculations(
    items: ManagedShiftItem[],
    shift: ManagedShift | null,
    isOpen: boolean,
    staffPercentMaster: number,
    staffPercentSalon: number,
    currentGuaranteedAmount: number | null,
): ShiftCalculations {
    const totalAmount = calculateTotalServiceAmount(items);
    const totalConsumables = calculateTotalConsumables(items);

    // A closed shift shows the values stored in the database.
    if (!isOpen && shift) {
        const masterShare = typeof shift.master_share === 'number' && !Number.isNaN(shift.master_share) ? shift.master_share : 0;
        const salonShare = typeof shift.salon_share === 'number' && !Number.isNaN(shift.salon_share) ? shift.salon_share : 0;
        return {
            totalAmount,
            totalConsumables,
            masterShare: Math.round(masterShare * 100) / 100,
            salonShare: Math.round(salonShare * 100) / 100,
            displayTotalAmount: shift.total_amount || 0,
        };
    }

    const base = calculateBaseShares(totalAmount, totalConsumables, staffPercentMaster, staffPercentSalon);
    const shares = calculateDisplayShares(base.masterShare, base.salonShare, currentGuaranteedAmount, isOpen);
    return { totalAmount, totalConsumables, masterShare: shares.masterShare, salonShare: shares.salonShare, displayTotalAmount: totalAmount };
}

/** "Services and materials": the summary card's total and its two parts. */
export function shiftSummaryAmounts(values: { displayTotalAmount: number; totalConsumables: number }) {
    return {
        services: values.displayTotalAmount,
        consumables: values.totalConsumables,
        total: values.displayTotalAmount + values.totalConsumables,
    };
}

/** The guarantee line of the "to staff" card, or null when the shift has none. */
export function guaranteeLine(
    shift: ManagedShift | null,
    isOpen: boolean,
    hourlyRate: number | null,
    currentHoursWorked: number | null,
    currentGuaranteedAmount: number | null,
): number | null {
    if (isOpen && hourlyRate && currentHoursWorked !== null && currentGuaranteedAmount !== null) return currentGuaranteedAmount;
    if (!isOpen && shift?.hourly_rate && shift.hours_worked !== null && shift.hours_worked !== undefined
        && shift.guaranteed_amount !== null && shift.guaranteed_amount !== undefined) return shift.guaranteed_amount;
    return null;
}

export function formatAmount(value: number, locale: Locale): string {
    return formatNumber(value, locale);
}

export function formatShare(value: number, total: number): string {
    if (total <= 0) return '0%';
    return `${((value / total) * 100).toFixed(1)}%`;
}

/** The period summary of /dashboard/staff/[id]/finance/stats. */
export function statsSummary(stats: StaffFinanceStatsPayload) {
    // totalAmount is the API's service-only amount; materials go to the business too.
    const turnover = stats.totalAmount + stats.totalConsumables;
    const topup = stats.totalTopupAmount ?? stats.shifts.reduce((sum, shift) =>
        sum + (shift.topup_amount ?? Math.max(0, shift.guaranteed_amount - (shift.base_master_share ?? shift.master_share))), 0);
    return {
        turnover,
        topup,
        guaranteeUsed: topup > 0,
        flags: {
            lateMinutes: stats.totalLateMinutes > 0 ? stats.totalLateMinutes : null,
            consumables: stats.totalConsumables > 0 ? stats.totalConsumables : null,
            guarantee: topup > 0 ? topup : null,
        },
    };
}

/** What a shift card shows as the employee's money: the guarantee when it exceeds the share. */
export function shiftEmployeeAmount(shift: StaffFinanceStatsShift): number {
    const guaranteeDominates = shift.guaranteed_amount > 0 && shift.guaranteed_amount > shift.master_share;
    return guaranteeDominates ? shift.guaranteed_amount : shift.master_share;
}

/** The stats request's date parameter for a period (useStaffFinanceStatsData). */
export function statsDateParam(period: StaffFinanceStatsPeriod, date: string): string {
    if (period === 'year') return date.split('-')[0] ?? date;
    if (period === 'month') return date.length >= 7 ? date.substring(0, 7) : date;
    if (date.length === 7) return `${date}-01`;
    if (date.length === 4) return `${date}-01-01`;
    return date;
}

/** The reference date moved by one period (day, month or year). */
export function shiftStatsDate(period: StaffFinanceStatsPeriod, date: string, step: number): string {
    const [year, month, day] = date.split('-').map(Number);
    if (period === 'year') return `${year + step}-01-01`;
    if (period === 'month') {
        const value = new Date(Date.UTC(year, month - 1 + step, 1));
        return value.toISOString().slice(0, 10);
    }
    const value = new Date(Date.UTC(year, month - 1, day + step));
    return value.toISOString().slice(0, 10);
}

export type HoursResult = { ok: true; hours: number } | { ok: false };

/** The shift card's hours correction: a number from 0 to the length of the shift's day. */
export function parseShiftHours(input: string, dayHours: number): HoursResult {
    const raw = input.trim().replace(',', '.');
    const value = Number(raw);
    if (!raw || !Number.isFinite(value) || value < 0 || value > dayHours) return { ok: false };
    return { ok: true, hours: value };
}

/** The items as the save and close commands carry them (wireItems of the website). */
export function wireShiftItems(items: ManagedShiftItem[]): WireShiftItem[] {
    return items.map((item) => ({
        ...(item.id ? { id: item.id } : {}),
        ...(item.clientId ? { clientId: item.clientId } : {}),
        clientName: item.clientName,
        serviceName: dedupeServiceNames(item.serviceName) || item.serviceName || '',
        serviceAmount: item.serviceAmount,
        consumablesAmount: item.consumablesAmount,
        bookingId: item.bookingId ?? null,
    }));
}

/** "A + A + B" → "A + B" (deduplicateServiceNameString). */
export function dedupeServiceNames(value: string | null | undefined): string {
    if (!value) return '';
    const seen = new Set<string>();
    return value.split('+').map((part) => part.trim()).filter((part) => {
        if (!part || seen.has(part)) return false;
        seen.add(part);
        return true;
    }).join(' + ');
}

export function serviceTitle(service: FinanceServiceName | string, locale: Locale): string {
    if (typeof service === 'string') return service;
    if (locale === 'ky' && service.name_ky) return service.name_ky;
    if (locale === 'en' && service.name_en) return service.name_en;
    return service.name_ru;
}

/** Service names of a booking, in the app language, joined like the website's client list. */
export function bookingServiceName(booking: FinanceBooking, locale: Locale): string {
    const services = Array.isArray(booking.services) ? booking.services : booking.services ? [booking.services] : [];
    return services.map((service) => serviceTitle(service, locale)).filter(Boolean).join(' + ');
}

export type ShiftItemDraft = { clientName: string; serviceName: string; serviceAmount: string; consumablesAmount: string; bookingId: string | null };

export type ShiftItemDraftResult = { ok: true; item: Omit<ManagedShiftItem, 'id' | 'clientId' | 'createdAt'> } | { ok: false; error: 'amount' | 'client' };

const MAX_AMOUNT = 100_000_000;

/** A client row from the editor: amounts 0–100 000 000; a row without a booking needs a client name or label. */
export function shiftItemFromDraft(draft: ShiftItemDraft, autoClientLabel: string): ShiftItemDraftResult {
    const serviceAmount = Number(draft.serviceAmount.trim().replace(',', '.') || 0);
    const consumablesAmount = Number(draft.consumablesAmount.trim().replace(',', '.') || 0);
    if (!Number.isFinite(serviceAmount) || !Number.isFinite(consumablesAmount)
        || serviceAmount < 0 || consumablesAmount < 0 || serviceAmount > MAX_AMOUNT || consumablesAmount > MAX_AMOUNT) {
        return { ok: false, error: 'amount' };
    }
    const clientName = draft.clientName.trim() || (draft.bookingId ? '' : autoClientLabel);
    return {
        ok: true,
        item: {
            clientName,
            serviceName: dedupeServiceNames(draft.serviceName.trim()),
            serviceAmount,
            consumablesAmount,
            bookingId: draft.bookingId,
        },
    };
}
