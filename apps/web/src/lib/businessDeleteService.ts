import { logError } from '@/lib/log';

export type BusinessDeleteAdminClientLike = {
    rpc(
        fn: 'delete_business_without_history',
        args: { p_biz_id: string },
    ): PromiseLike<{ error: { message?: string; code?: string } | null }>;
};

type BusinessDeleteResult =
    | { ok: true }
    | { ok: false; error: 'not_found' | 'conflict' | 'internal'; message: string; status: 404 | 409 | 500 };

export const BUSINESS_HAS_HISTORY_MESSAGE =
    'У бизнеса есть история: записи, смены, финансовые операции или проданные пакеты. Удалить можно только бизнес без истории. Снимите одобрение — бизнес скроется из каталога, данные сохранятся.';

/**
 * Permanent deletion of a business without history (DB-14), e.g. one created by mistake. The
 * database command checks and deletes in one transaction; the owner keeps the account and loses
 * the roles of this business.
 */
export async function runBusinessDelete({
    admin,
    bizId,
}: {
    admin: BusinessDeleteAdminClientLike;
    bizId: string;
}): Promise<BusinessDeleteResult> {
    const { error } = await admin.rpc('delete_business_without_history', { p_biz_id: bizId });
    if (!error) return { ok: true };
    if (error.message === 'BUSINESS_NOT_FOUND') {
        return { ok: false, error: 'not_found', message: 'Бизнес не найден', status: 404 };
    }
    if (error.message === 'BUSINESS_HAS_HISTORY') {
        return { ok: false, error: 'conflict', message: BUSINESS_HAS_HISTORY_MESSAGE, status: 409 };
    }
    logError('BusinessDelete', 'delete_business_without_history failed', { code: error.code, message: error.message });
    return { ok: false, error: 'internal', message: 'Не удалось удалить бизнес', status: 500 };
}
