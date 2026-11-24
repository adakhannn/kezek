import { logError } from '@/lib/log';
import type { DbRpcClient } from '@/lib/supabaseTypes';

type Result =
    | {
          ok: false;
          statusCode: 400 | 409 | 500;
          errorType: 'validation' | 'conflict' | 'internal';
          message: string;
          details?: Record<string, unknown>;
      }
    | {
          ok: true;
      };

export const BRANCH_IN_USE_MESSAGE =
    'Филиал ещё используется: в нём есть активные сотрудники или услуги, либо по его услугам продаются пакеты. Переведите сотрудников и выключите услуги, затем повторите.';
export const BRANCH_HAS_HISTORY_MESSAGE =
    'Удалить можно только филиал без истории: без записей (в том числе отменённых), смен, использованных акций и сотрудников с историей. Сделайте филиал неактивным — данные сохранятся.';

/**
 * Permanent deletion of a branch without history (DB-14, ARCH-08). The database command checks
 * and deletes in one transaction: remaining inactive masters without history (ENG-69), legacy
 * schedule rules, assignments and inactive services go with the branch. Bookings, shifts and
 * promotion usage are never deleted; a branch that has them is deactivated instead.
 */
export async function runBranchDelete({
    admin,
    branchId,
    bizId,
}: {
    admin: DbRpcClient;
    branchId: string;
    bizId: string;
}): Promise<Result> {
    const { error } = await admin.rpc('delete_branch_without_history', { p_biz_id: bizId, p_branch_id: branchId });
    if (!error) return { ok: true };

    if (error.message === 'BRANCH_NOT_FOUND') {
        return { ok: false, statusCode: 400, errorType: 'validation', message: 'Филиал не принадлежит этому бизнесу' };
    }
    if (error.message === 'BRANCH_IN_USE') {
        return { ok: false, statusCode: 409, errorType: 'conflict', message: BRANCH_IN_USE_MESSAGE, details: { code: 'BRANCH_IN_USE' } };
    }
    if (error.message === 'BRANCH_HAS_HISTORY') {
        return { ok: false, statusCode: 409, errorType: 'conflict', message: BRANCH_HAS_HISTORY_MESSAGE, details: { code: 'BRANCH_HAS_HISTORY' } };
    }
    logError('BranchDelete', 'delete_branch_without_history failed', { code: error.code, message: error.message });
    return { ok: false, statusCode: 500, errorType: 'internal', message: 'Не удалось удалить филиал' };
}
