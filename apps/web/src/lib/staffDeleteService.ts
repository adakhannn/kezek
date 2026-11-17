export type StaffDeleteAdminClientLike = {
    rpc(
        fn: 'delete_staff_without_history',
        args: { p_biz_id: string; p_staff_id: string },
    ): PromiseLike<{ error: { message?: string; code?: string } | null }>;
};

type StaffDeleteResult =
    | {
          ok: true;
      }
    | {
          ok: false;
          error: string;
          message: string;
          status: number;
      };

export const STAFF_HAS_HISTORY_MESSAGE =
    'Удалить можно только сотрудника без записей, смен и опубликованного графика. У этого сотрудника есть история работы — увольте его в карточке: данные сохранятся.';

/**
 * Permanent deletion of a staff member who has no history (for example, one created by
 * mistake). The database command checks and deletes in one transaction; a master with
 * bookings, shifts, published schedules or finance operations is dismissed instead (API-05).
 */
export async function runStaffDeleteService({
    admin,
    bizId,
    staffId,
}: {
    admin: StaffDeleteAdminClientLike;
    bizId: string;
    staffId: string;
}): Promise<StaffDeleteResult> {
    const { error } = await admin.rpc('delete_staff_without_history', { p_biz_id: bizId, p_staff_id: staffId });
    if (!error) {
        return { ok: true };
    }
    if (error.message === 'STAFF_NOT_FOUND') {
        return { ok: false, error: 'not_found', message: 'Сотрудник не найден', status: 404 };
    }
    if (error.message === 'STAFF_HAS_HISTORY') {
        return { ok: false, error: 'conflict', message: STAFF_HAS_HISTORY_MESSAGE, status: 409 };
    }
    return { ok: false, error: 'internal', message: 'Не удалось удалить сотрудника', status: 500 };
}
