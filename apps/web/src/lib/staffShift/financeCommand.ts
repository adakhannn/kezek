import type { ShiftFinancials } from '@/lib/financeDomain/shift';

export type FinanceCommandClient = {
    rpc: (name: string, args: Record<string, unknown>) => PromiseLike<{
        data: unknown;
        error: { code?: string; message?: string } | null;
    }>;
};

export function financeCommandFailure(error: { code?: string; message?: string }) {
    if (error.code === '42501') {
        return { ok: false as const, statusCode: 403, errorType: 'forbidden' as const,
            message: 'Нет доступа к смене или связанным записям.' };
    }
    if (error.code === '40001') {
        return { ok: false as const, statusCode: 409, errorType: 'validation' as const,
            message: 'Смена изменилась. Черновик не сохранён. Сверьте его с актуальными данными перед повторной записью.' };
    }
    if (error.code === '22023' || error.code === '22P02' || error.code === '23514') {
        return { ok: false as const, statusCode: 400, errorType: 'validation' as const,
            message: 'Неверные данные смены или смена не открыта. Проверьте позиции и дату.' };
    }
    return { ok: false as const, statusCode: 500, errorType: 'internal' as const,
        message: 'Не удалось сохранить финансовую операцию. Изменения не подтверждены.' };
}

export function commitShiftClose(params: {
    client: FinanceCommandClient;
    shiftId: string;
    actorId: string | null;
    revision: number;
    staff: { percent_master: number | null; percent_salon: number | null; hourly_rate: number | null };
    financials: ShiftFinancials;
    hoursWorked: number | null;
    closedAt: string;
}) {
    const { client, shiftId, actorId, revision, staff, financials, hoursWorked, closedAt } = params;
    return client.rpc('close_staff_shift_command', {
        p_shift_id: shiftId,
        p_actor_id: actorId,
        p_expected_revision: revision,
        p_expected_settings: {
            percent_master: staff.percent_master ?? null,
            percent_salon: staff.percent_salon ?? null,
            hourly_rate: staff.hourly_rate ?? null,
        },
        p_calculation: { ...financials, hoursWorked, hourlyRate: staff.hourly_rate ?? null, closedAt },
    });
}
