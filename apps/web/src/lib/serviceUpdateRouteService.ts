import type { SupabaseClient } from '@supabase/supabase-js';

import { checkResourceBelongsToBiz } from '@/lib/dbHelpers';

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

type ServiceRecord = { id: string; biz_id: string; name_ru: string };

export type ServiceUpdateAdminClientLike = {
    from: SupabaseClient['from'];
};

function normalizeOptionalName(value?: string | null) {
    return value?.trim() || null;
}

function validationError(message: string): BaseError {
    return { ok: false, error: 'validation', message, status: 400 };
}

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

    if (body.price_from > 0 && body.price_to > 0 && body.price_from > body.price_to) {
        return validationError('Минимальная цена не может быть больше максимальной');
    }

    const serviceCheck = await checkResourceBelongsToBiz<ServiceRecord>(
        admin as never,
        'services',
        serviceId,
        bizId,
        'id, biz_id, name_ru'
    );

    if (serviceCheck.error || !serviceCheck.data) {
        return {
            ok: false,
            error: 'forbidden',
            message: 'Услуга не принадлежит этому бизнесу',
            status: 403,
        };
    }

    const svc = serviceCheck.data;
    const branchIds: string[] = body.branch_ids ?? (body.branch_id ? [body.branch_id] : []);
    if (branchIds.length === 0) {
        return validationError('Необходимо указать хотя бы один филиал');
    }

    const { data: brRows, error: brErr } = await admin.from('branches').select('id,biz_id').eq('biz_id', bizId).in('id', branchIds);
    if (brErr) {
        return { ok: false, error: 'validation', message: brErr.message, status: 400 };
    }

    const found = new Set((brRows ?? []).map((row: { id: string }) => String(row.id)));
    const missing = branchIds.filter((id) => !found.has(String(id)));
    if (missing.length) {
        return {
            ok: false,
            error: 'forbidden',
            message: 'Некоторые филиалы не принадлежат этому бизнесу',
            details: { missing },
            status: 403,
        };
    }

    const { data: existingServices } = await admin
        .from('services')
        .select('id,branch_id')
        .eq('biz_id', bizId)
        .eq('name_ru', svc.name_ru);

    const existingBranchIds = new Set<string>((existingServices ?? []).map((service: { branch_id: string }) => service.branch_id));
    const toAdd = branchIds.filter((id) => !existingBranchIds.has(id));
    const toUpdate = branchIds.filter((id) => existingBranchIds.has(id));
    const toRemove = Array.from(existingBranchIds).filter((id) => !branchIds.includes(id));

    const name_ky = normalizeOptionalName(body.name_ky);
    const name_en = normalizeOptionalName(body.name_en);
    const updatePayload = {
        name_ru: body.name_ru.trim(),
        name_ky,
        name_en,
        duration_min: body.duration_min,
        price_from: body.price_from ?? 0,
        price_to: body.price_to ?? 0,
        active: !!body.active,
    };

    if (toUpdate.length > 0) {
        const { error } = await admin
            .from('services')
            .update(updatePayload)
            .eq('biz_id', bizId)
            .eq('name_ru', svc.name_ru)
            .in('branch_id', toUpdate);

        if (error) {
            return { ok: false, error: 'validation', message: error.message, status: 400 };
        }
    }

    if (toAdd.length > 0) {
        const rows = toAdd.map((branch_id) => ({
            biz_id: bizId,
            branch_id,
            ...updatePayload,
        }));
        const { error } = await admin.from('services').insert(rows);
        if (error) {
            return { ok: false, error: 'validation', message: error.message, status: 400 };
        }
    }

    if (toRemove.length > 0) {
        const branchesWithBookings: string[] = [];

        for (const branchId of toRemove) {
            const { data: existingService } = await admin
                .from('services')
                .select('id')
                .eq('biz_id', bizId)
                .eq('name_ru', svc.name_ru)
                .eq('branch_id', branchId)
                .maybeSingle();

            if (!existingService) {
                continue;
            }

            const now = new Date().toISOString();
            const { count: bookingCount } = await admin
                .from('bookings')
                .select('id', { count: 'exact', head: true })
                .eq('service_id', existingService.id)
                .gte('start_at', now)
                .neq('status', 'cancelled');

            if ((bookingCount ?? 0) > 0) {
                const { data: branchData } = await admin.from('branches').select('name').eq('id', branchId).maybeSingle();
                branchesWithBookings.push(branchData?.name || branchId);
                continue;
            }

            const { error: deleteError } = await admin.from('services').delete().eq('id', existingService.id).eq('biz_id', bizId);
            if (!deleteError) {
                continue;
            }

            const errorMessage = String(deleteError.message || '').toLowerCase();
            if (errorMessage.includes('foreign key') || errorMessage.includes('bookings_service_id_fkey')) {
                const { error: softDeleteError } = await admin
                    .from('services')
                    .update({ active: false })
                    .eq('id', existingService.id)
                    .eq('biz_id', bizId);

                if (softDeleteError) {
                    return {
                        ok: false,
                        error: 'validation',
                        message: `Не удалось отвязать услугу из филиала: ${softDeleteError.message}`,
                        status: 400,
                    };
                }
                continue;
            }

            return {
                ok: false,
                error: 'validation',
                message: `Не удалось удалить услугу из филиала: ${deleteError.message}`,
                status: 400,
            };
        }

        if (branchesWithBookings.length > 0) {
            const branchNames = branchesWithBookings.join(', ');
            return {
                ok: false,
                error: 'conflict',
                message: `Невозможно отвязать услугу от филиала${branchesWithBookings.length > 1 ? 'ов' : ''} "${branchNames}": к ${branchesWithBookings.length > 1 ? 'ним' : 'нему'} привязаны будущие брони. Сначала отмените или удалите все будущие брони.`,
                details: { branches: branchesWithBookings },
                status: 409,
            };
        }
    }

    return { ok: true };
}
