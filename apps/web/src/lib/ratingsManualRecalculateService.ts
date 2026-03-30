type AdminClientLike = {
    rpc: (fn: string, params: Record<string, unknown>) => Promise<unknown>;
    from: (table: string) => {
        insert: (payload: Record<string, unknown>) => Promise<unknown>;
    };
};

export type RatingsManualRecalculateInput = {
    entity_type?: 'staff' | 'branch' | 'biz';
    entity_id?: string;
    date_from?: string | null;
    date_to?: string | null;
};

export async function runRatingsManualRecalculate({
    admin,
    userId,
    body,
}: {
    admin: AdminClientLike;
    userId: string;
    body: RatingsManualRecalculateInput;
}): Promise<
    | {
          ok: true;
          data: {
              ok: true;
              entity_type: 'staff' | 'branch' | 'biz';
              entity_id: string;
              action: 'recalculate_metrics' | 'recalculate_rating';
          };
      }
    | {
          ok: false;
          error: 'bad_request' | 'internal';
          message: string;
          status: 400 | 500;
      }
> {
    const { entity_type, entity_id, date_from, date_to } = body;

    if (!entity_type || !entity_id) {
        return {
            ok: false,
            error: 'bad_request',
            message: 'entity_type и entity_id обязательны',
            status: 400,
        };
    }

    const parsedDateFrom = date_from ? new Date(date_from) : null;
    const parsedDateTo = date_to ? new Date(date_to) : null;
    const action: 'recalculate_metrics' | 'recalculate_rating' =
        parsedDateFrom && parsedDateTo ? 'recalculate_metrics' : 'recalculate_rating';

    let status: 'success' | 'error' = 'success';
    let errorMessage: string | null = null;

    try {
        if (action === 'recalculate_metrics') {
            const startDate = parsedDateFrom!.toISOString().slice(0, 10);
            const endDate = parsedDateTo!.toISOString().slice(0, 10);

            await admin.rpc('recalculate_ratings_for_date_range', {
                p_start_date: startDate,
                p_end_date: endDate,
            });

            if (entity_type === 'staff') {
                await admin.rpc('calculate_staff_rating', { p_staff_id: entity_id });
            } else if (entity_type === 'branch') {
                await admin.rpc('calculate_branch_rating', { p_branch_id: entity_id });
            } else {
                await admin.rpc('calculate_biz_rating', { p_biz_id: entity_id });
            }
        } else {
            if (entity_type === 'staff') {
                await admin.rpc('calculate_staff_rating', { p_staff_id: entity_id });
            } else if (entity_type === 'branch') {
                await admin.rpc('calculate_branch_rating', { p_branch_id: entity_id });
            } else {
                await admin.rpc('calculate_biz_rating', { p_biz_id: entity_id });
            }
        }
    } catch (error) {
        status = 'error';
        errorMessage = error instanceof Error ? error.message : String(error);
    }

    try {
        await admin.from('rating_manual_recalc_log').insert({
            user_id: userId,
            entity_type,
            entity_id,
            date_from: parsedDateFrom ? parsedDateFrom.toISOString().slice(0, 10) : null,
            date_to: parsedDateTo ? parsedDateTo.toISOString().slice(0, 10) : null,
            action,
            status,
            error_message: errorMessage,
        });
    } catch {
        // best effort only
    }

    if (status === 'error') {
        return {
            ok: false,
            error: 'internal',
            message: errorMessage || 'Ошибка пересчёта рейтинга',
            status: 500,
        };
    }

    return {
        ok: true,
        data: {
            ok: true,
            entity_type,
            entity_id,
            action,
        },
    };
}
