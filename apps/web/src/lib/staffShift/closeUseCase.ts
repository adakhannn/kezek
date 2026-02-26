import { calculateShiftFinancials, type ShiftFinancials } from '@/lib/financeDomain/shift';
import { logDebug } from '@/lib/log';

type StaffShiftStatus = 'open' | 'closed';

export type StaffShiftSnapshot = {
    id: string;
    staff_id: string;
    biz_id: string;
    shift_date: string;
    status: StaffShiftStatus;
    opened_at: string | null;
};

export type CloseShiftItemInput = {
    serviceAmount?: number | null;
    amount?: number | null;
    consumablesAmount?: number | null;
    consumables_amount?: number | null;
};

export type StaffFinanceSettings = {
    percentMaster?: number | null;
    percentSalon?: number | null;
    hourlyRate?: number | null;
};

export type CloseStaffShiftInput = {
    now: Date;
    staff: StaffFinanceSettings;
    shift: StaffShiftSnapshot | null;
    items: CloseShiftItemInput[];
    totalAmountRaw: number;
    consumablesAmountRaw: number;
};

export type CloseStaffShiftDomainResult =
    | {
          kind: 'no_shift';
      }
    | {
          kind: 'already_closed';
          currentStatus: StaffShiftStatus;
      }
    | {
          kind: 'ok';
          totalAmount: number;
          totalConsumables: number;
          hoursWorked: number | null;
          financials: ShiftFinancials;
      };

/**
 * Доменный use-case закрытия смены с пересчётом часов и финансов.
 *
 * Не знает про Supabase, HTTP, RPC — только про:
 * - наличие/статус смены,
 * - настройки сотрудника,
 * - позиции смены (items) и суммарные значения из тела запроса,
 * - расчёт hoursWorked и ShiftFinancials.
 */
export function closeStaffShiftUseCase(
    input: CloseStaffShiftInput,
): CloseStaffShiftDomainResult {
    const { now, staff, shift, items, totalAmountRaw, consumablesAmountRaw } = input;

    if (!shift) {
        return { kind: 'no_shift' };
    }

    if (shift.status === 'closed') {
        return {
            kind: 'already_closed',
            currentStatus: shift.status,
        };
    }

    const percentMaster = Number(staff.percentMaster ?? 60);
    const percentSalon = Number(staff.percentSalon ?? 40);
    const hourlyRate = staff.hourlyRate != null ? Number(staff.hourlyRate) : null;

    const safeItems = Array.isArray(items) ? items : [];

    const totalServiceAmount = safeItems.reduce((sum, raw) => {
        const it = raw ?? {};
        const value = Number(it.serviceAmount ?? it.amount ?? 0);
        return sum + (Number.isFinite(value) && value > 0 ? value : 0);
    }, 0);

    const totalConsumablesFromItems = safeItems.reduce((sum, raw) => {
        const it = raw ?? {};
        const value = Number(it.consumablesAmount ?? it.consumables_amount ?? 0);
        return sum + (Number.isFinite(value) && value > 0 ? value : 0);
    }, 0);

    const totalAmount = safeItems.length > 0 ? totalServiceAmount : Number(totalAmountRaw || 0);
    const totalConsumables =
        safeItems.length > 0 ? totalConsumablesFromItems : Number(consumablesAmountRaw || 0);

    let hoursWorked: number | null = null;

    if (hourlyRate && shift.opened_at) {
        const openedAt = new Date(shift.opened_at);
        const diffMs = now.getTime() - openedAt.getTime();
        hoursWorked = Math.round((diffMs / (1000 * 60 * 60)) * 100) / 100;

        logDebug('StaffShiftCloseUseCase', 'Hours calculation', {
            openedAt: shift.opened_at,
            openedAtDate: openedAt.toISOString(),
            now: now.toISOString(),
            diffMs,
            hoursWorked,
        });
    }

    const financials = calculateShiftFinancials({
        totalAmount,
        totalConsumables,
        percentMaster,
        percentSalon,
        hoursWorked,
        hourlyRate,
    });

    return {
        kind: 'ok',
        totalAmount,
        totalConsumables,
        hoursWorked,
        financials,
    };
}

