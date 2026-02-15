export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';

import { getBizContextForManagers } from '@/lib/authBiz';
import { checkResourceBelongsToBiz } from '@/lib/dbHelpers';
import { getRouteParamRequired } from '@/lib/routeParams';
import { getServiceClient } from '@/lib/supabaseService';

type Body = {
    name_ru: string;
    name_ky?: string | null;
    name_en?: string | null;
    duration_min: number;
    price_from: number;
    price_to: number;
    active: boolean;
    branch_id?: string; // старый формат (для обратной совместимости)
    branch_ids?: string[]; // новый формат (множественный выбор)
    service_id?: string; // ID текущей услуги для поиска всех "копий"
};

export async function POST(req: Request, context: unknown) {
    try {
        const serviceId = await getRouteParamRequired(context, 'id');
        const { bizId } = await getBizContextForManagers();
        const admin = getServiceClient();

        const body = await req.json().catch(() => ({} as Body));
        if (!body.name_ru?.trim()) return NextResponse.json({ ok: false, error: 'NAME_REQUIRED' }, { status: 400 });
        if (!body.duration_min || body.duration_min <= 0) return NextResponse.json({ ok: false, error: 'DURATION_INVALID' }, { status: 400 });

        // услуга принадлежит бизнесу? (используем унифицированную утилиту)
        const serviceCheck = await checkResourceBelongsToBiz<{ id: string; biz_id: string; name_ru: string }>(
            admin,
            'services',
            serviceId,
            bizId,
            'id, biz_id, name_ru'
        );
        if (serviceCheck.error || !serviceCheck.data) {
            return NextResponse.json({ ok: false, error: 'SERVICE_NOT_IN_THIS_BUSINESS' }, { status: 400 });
        }
        const svc = serviceCheck.data;

        // Определяем список филиалов
        const branchIds: string[] = body.branch_ids ?? (body.branch_id ? [body.branch_id] : []);
        if (branchIds.length === 0) {
            return NextResponse.json({ ok: false, error: 'BRANCH_REQUIRED' }, { status: 400 });
        }

        // Проверяем, что все филиалы принадлежат бизнесу
        const { data: brRows, error: brErr } = await admin
            .from('branches')
            .select('id,biz_id')
            .eq('biz_id', bizId)
            .in('id', branchIds);

        if (brErr) {
            return NextResponse.json({ ok: false, error: brErr.message }, { status: 400 });
        }

        const found = new Set((brRows ?? []).map((r) => String(r.id)));
        const missing = branchIds.filter((id) => !found.has(String(id)));
        if (missing.length) {
            return NextResponse.json({
                ok: false,
                error: 'BRANCH_NOT_IN_THIS_BUSINESS',
                details: { missing },
            }, { status: 400 });
        }

        // Находим все услуги с таким же названием в этом бизнесе (это "копии" услуги в разных филиалах)
        const { data: existingServices } = await admin
            .from('services')
            .select('id,branch_id')
            .eq('biz_id', bizId)
            .eq('name_ru', svc.name_ru);

        const existingBranchIds = new Set((existingServices ?? []).map((s) => s.branch_id));
        const toAdd = branchIds.filter((id) => !existingBranchIds.has(id));
        const toUpdate = branchIds.filter((id) => existingBranchIds.has(id));
        const toRemove = Array.from(existingBranchIds).filter((id) => !branchIds.includes(id));

        // Обновляем существующие записи
        if (toUpdate.length > 0) {
            const name_ky = body.name_ky?.trim() || null;
            const name_en = body.name_en?.trim() || null;
            const { error: eUpd } = await admin
                .from('services')
                .update({
                    name_ru: body.name_ru.trim(),
                    name_ky,
                    name_en,
                    duration_min: body.duration_min,
                    price_from: body.price_from ?? 0,
                    price_to: body.price_to ?? 0,
                    active: !!body.active,
                })
                .eq('biz_id', bizId)
                .eq('name_ru', svc.name_ru)
                .in('branch_id', toUpdate);

            if (eUpd) return NextResponse.json({ ok: false, error: eUpd.message }, { status: 400 });
        }

        // Создаём новые записи для добавленных филиалов
        if (toAdd.length > 0) {
            const name_ky = body.name_ky?.trim() || null;
            const name_en = body.name_en?.trim() || null;
            const rows = toAdd.map((branch_id) => ({
                biz_id: bizId,
                branch_id,
                name_ru: body.name_ru.trim(),
                name_ky,
                name_en,
                duration_min: body.duration_min,
                price_from: body.price_from ?? 0,
                price_to: body.price_to ?? 0,
                active: !!body.active,
            }));

            const { error: eIns } = await admin.from('services').insert(rows);
            if (eIns) return NextResponse.json({ ok: false, error: eIns.message }, { status: 400 });
        }

        // Удаляем записи для убранных филиалов (только если нет броней)
        if (toRemove.length > 0) {
            const branchesWithBookings: string[] = [];
            
            for (const branchId of toRemove) {
                // Проверяем, есть ли брони для этой услуги в этом филиале
                const { data: existingService } = await admin
                    .from('services')
                    .select('id')
                    .eq('biz_id', bizId)
                    .eq('name_ru', svc.name_ru)
                    .eq('branch_id', branchId)
                    .maybeSingle();

                if (existingService) {
                    // Проверяем только будущие брони (прошедшие не должны блокировать отвязку)
                    const now = new Date().toISOString();
                    const { count: bookingCount } = await admin
                        .from('bookings')
                        .select('id', { count: 'exact', head: true })
                        .eq('service_id', existingService.id)
                        .gte('start_at', now) // Только будущие брони
                        .neq('status', 'cancelled'); // Исключаем отмененные

                    if ((bookingCount ?? 0) > 0) {
                        // Есть будущие брони - запоминаем филиал
                        const { data: branchData } = await admin
                            .from('branches')
                            .select('name')
                            .eq('id', branchId)
                            .maybeSingle();
                        branchesWithBookings.push(branchData?.name || branchId);
                    } else {
                        // Нет будущих броней - пытаемся удалить
                        // Сначала пробуем физическое удаление
                        const { error: eDel } = await admin
                            .from('services')
                            .delete()
                            .eq('id', existingService.id)
                            .eq('biz_id', bizId);

                        if (eDel) {
                            // Если ошибка из-за внешнего ключа (есть прошедшие брони),
                            // используем мягкое удаление - помечаем как неактивную
                            const errorMsg = eDel.message.toLowerCase();
                            if (errorMsg.includes('foreign key') || errorMsg.includes('bookings_service_id_fkey')) {
                                // Мягкое удаление: помечаем услугу как неактивную
                                // Это позволит "отвязать" услугу от филиала, сохранив историю броней
                                const { error: eSoftDel } = await admin
                                    .from('services')
                                    .update({ active: false })
                                    .eq('id', existingService.id)
                                    .eq('biz_id', bizId);

                                if (eSoftDel) {
                                    return NextResponse.json({
                                        ok: false,
                                        error: `Не удалось отвязать услугу из филиала: ${eSoftDel.message}`,
                                    }, { status: 400 });
                                }
                                // Успешно пометили как неактивную - услуга "отвязана" от филиала
                            } else {
                                // Другая ошибка - возвращаем её
                                return NextResponse.json({
                                    ok: false,
                                    error: `Не удалось удалить услугу из филиала: ${eDel.message}`,
                                }, { status: 400 });
                            }
                        }
                        // Успешно удалено физически
                    }
                }
            }
            
            // Если есть филиалы с бронями, возвращаем ошибку
            if (branchesWithBookings.length > 0) {
                const branchNames = branchesWithBookings.join(', ');
                return NextResponse.json({
                    ok: false,
                    error: 'HAS_BOOKINGS',
                    message: `Невозможно отвязать услугу от филиала${branchesWithBookings.length > 1 ? 'ов' : ''} "${branchNames}": к ${branchesWithBookings.length > 1 ? 'ним' : 'нему'} привязаны будущие брони. Сначала отмените или удалите все будущие брони.`,
                }, { status: 400 });
            }
        }

        return NextResponse.json({ ok: true });
    } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e);
        return NextResponse.json({ok: false, error: msg}, {status: 500});
    }
}
