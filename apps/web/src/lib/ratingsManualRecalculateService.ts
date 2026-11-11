import { logError } from '@/lib/log';

type AdminClientLike = {
    rpc: (fn: string, params: Record<string, unknown>) => PromiseLike<{ error?: { message: string } | null }>;
    from: (table: string) => {
        insert: (payload: Record<string, unknown>) => PromiseLike<{ error?: { message: string } | null }>;
    };
};

export type RatingsManualRecalculateInput = {
    entity_type?: 'staff' | 'branch' | 'biz';
    entity_id?: string;
    date_from?: string | null;
    date_to?: string | null;
};

type RecalculateFailure = { ok: false; error: 'bad_request' | 'internal'; message: string; status: 400 | 500 };

function validDate(value: unknown): value is string {
    if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
    const date = new Date(`${value}T00:00:00.000Z`);
    return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

export async function runRatingsManualRecalculate({ admin, userId, body }: {
    admin: AdminClientLike;
    userId: string;
    body: RatingsManualRecalculateInput;
}): Promise<
    | { ok: true; data: { ok: true; entity_type: 'staff' | 'branch' | 'biz'; entity_id: string; action: 'recalculate_metrics' | 'recalculate_rating' } }
    | RecalculateFailure
> {
    const { entity_type, entity_id, date_from, date_to } = body ?? {};
    if (!entity_type || !['staff', 'branch', 'biz'].includes(entity_type) || typeof entity_id !== 'string' || !entity_id.trim()) {
        return { ok: false, error: 'bad_request', message: 'entity_type и entity_id обязательны', status: 400 };
    }
    const hasRange = date_from != null || date_to != null;
    if (hasRange && (!validDate(date_from) || !validDate(date_to) || date_from > date_to)) {
        return { ok: false, error: 'bad_request', message: 'Укажите корректный диапазон дат YYYY-MM-DD', status: 400 };
    }
    const action = hasRange ? 'recalculate_metrics' as const : 'recalculate_rating' as const;
    let errorMessage: string | null = null;
    try {
        if (hasRange) {
            const result = await admin.rpc('recalculate_ratings_for_date_range', {
                p_start_date: date_from, p_end_date: date_to,
            });
            if (result.error) throw new Error(result.error.message);
        }
        const result = await admin.rpc(`calculate_${entity_type}_rating`, { [`p_${entity_type}_id`]: entity_id });
        if (result.error) throw new Error(result.error.message);
    } catch (error) {
        errorMessage = error instanceof Error ? error.message : String(error);
    }

    try {
        const log = await admin.from('rating_manual_recalc_log').insert({
            user_id: userId, entity_type, entity_id, date_from: date_from ?? null, date_to: date_to ?? null,
            action, status: errorMessage === null ? 'success' : 'error', error_message: errorMessage,
        });
        if (log.error) logError('RatingsManualRecalculate', 'Could not persist audit result', log.error);
    } catch (error) {
        logError('RatingsManualRecalculate', 'Could not persist audit result', error);
    }
    if (errorMessage !== null) {
        return { ok: false, error: 'internal', message: errorMessage || 'Ошибка пересчёта рейтинга', status: 500 };
    }
    return { ok: true, data: { ok: true, entity_type, entity_id, action } };
}
