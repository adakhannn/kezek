import { logError } from '@/lib/log';

export type ServiceUpdateBody = {
    name_ru: string;
    name_ky?: string | null;
    name_en?: string | null;
    duration_min: number;
    price_from: number;
    price_to: number;
    active: boolean;
    branch_id?: string;
    branch_ids?: string[];
    service_id?: string;
};

type BaseError = {
    ok: false;
    error: string;
    message: string;
    details?: unknown;
    status: number;
};

type Success = { ok: true };

type RpcError = { code?: string; message: string; details?: string | null };

export type ServiceUpdateAdminClientLike = {
    rpc(fn: 'update_service_group', args: Record<string, unknown>): PromiseLike<{ data: unknown; error: RpcError | null }>;
};

function normalizeOptionalName(value?: string | null) {
    return value?.trim() || null;
}

function validationError(message: string): BaseError {
    return { ok: false, error: 'validation', message, status: 400 };
}

/**
 * Saves the edit form of a service across its branches (ARCH-07). A service offered in several
 * branches is one row per branch, grouped by name; update_service_group locks the group, checks the
 * branches and the future bookings of the branches being removed, and saves every change in one
 * transaction, so an error leaves the service as it was.
 */
export async function runServiceUpdateFlow({
    admin,
    bizId,
    serviceId,
    body,
}: {
    admin: ServiceUpdateAdminClientLike;
    bizId: string;
    serviceId: string;
    body: ServiceUpdateBody;
}): Promise<Success | BaseError> {
    if (!body.name_ru?.trim()) {
        return validationError('Имя обязательно');
    }
    if (!Number.isInteger(body.duration_min) || body.duration_min < 1) {
        return validationError('Длительность должна быть больше 0');
    }

    if (
        !Number.isFinite(body.price_from)
        || !Number.isFinite(body.price_to)
        || body.price_from < 0
        || body.price_to < 0
    ) {
        return validationError('Цена не может быть отрицательной');
    }

    // The database requires price_to >= price_from (services_price_range_check).
    if (body.price_from > body.price_to) {
        return validationError('Минимальная цена не может быть больше максимальной');
    }

    const branchIds: string[] = body.branch_ids ?? (body.branch_id ? [body.branch_id] : []);
    if (branchIds.length === 0) {
        return validationError('Необходимо указать хотя бы один филиал');
    }

    const { error } = await admin.rpc('update_service_group', {
        p_biz_id: bizId,
        p_service_id: serviceId,
        p_branch_ids: branchIds,
        p_name_ru: body.name_ru.trim(),
        p_name_ky: normalizeOptionalName(body.name_ky),
        p_name_en: normalizeOptionalName(body.name_en),
        p_duration_min: body.duration_min,
        p_price_from: body.price_from,
        p_price_to: body.price_to,
        p_active: !!body.active,
    });
    if (!error) return { ok: true };

    const message = error.message ?? '';
    if (message.includes('SERVICE_FORBIDDEN')) {
        return { ok: false, error: 'forbidden', message: 'Услуга не принадлежит этому бизнесу', status: 403 };
    }
    if (message.includes('SERVICE_BRANCH_REQUIRED')) {
        return validationError('Необходимо указать хотя бы один филиал');
    }
    if (message.includes('SERVICE_BRANCH_FORBIDDEN')) {
        return {
            ok: false,
            error: 'forbidden',
            message: 'Некоторые филиалы не принадлежат этому бизнесу',
            details: { missing: (error.details ?? '').split(',').filter(Boolean) },
            status: 403,
        };
    }
    if (message.includes('SERVICE_BRANCH_HAS_FUTURE_BOOKINGS')) {
        const branches = (error.details ?? '').split(', ').filter(Boolean);
        const names = branches.join(', ');
        return {
            ok: false,
            error: 'conflict',
            // One whole sentence for one branch and one for several, so the API can translate it (FE-10).
            message: branches.length > 1
                ? `Невозможно отвязать услугу от филиалов "${names}": к ним привязаны будущие брони. Сначала отмените или удалите все будущие брони. Изменения не сохранены.`
                : `Невозможно отвязать услугу от филиала "${names}": к нему привязаны будущие брони. Сначала отмените или удалите все будущие брони. Изменения не сохранены.`,
            details: { branches },
            status: 409,
        };
    }
    // services_price_range_check or services_duration_min_check.
    if (error.code === '23514') {
        return validationError('Проверьте длительность и цены услуги');
    }
    // lock_timeout of the command: another request is changing this service right now.
    if (error.code === '55P03' || error.code === '57014') {
        return {
            ok: false,
            error: 'service_unavailable',
            message: 'Услугу сейчас изменяет другой запрос. Изменения не сохранены — повторите через несколько секунд.',
            status: 503,
        };
    }
    logError('ServiceUpdate', 'update_service_group failed', { code: error.code, message });
    return { ok: false, error: 'internal', message: 'Не удалось сохранить услугу. Изменения не сохранены.', status: 500 };
}
