import { notFound } from 'next/navigation';


import EditServicePageClient from './EditServicePageClient';

import { getBizContextForManagers } from '@/lib/authBiz';
import { getServiceClient } from '@/lib/supabaseService';


export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export default async function EditServicePage({
    params,
}: {
    params: Promise<{ id: string }>;
}) {
    const { id } = await params;
    const { bizId } = await getBizContextForManagers();
    // Используем service client для обхода RLS, т.к. доступ уже проверен через getBizContextForManagers
    const admin = getServiceClient();

    const [{ data: svc, error: svcError }, { data: branches, error: branchesError }] = await Promise.all([
        admin
            .from('services')
            .select('id,name_ru,name_ky,name_en,duration_min,price_from,price_to,active,branch_id,biz_id')
            .eq('id', id)
            .maybeSingle(),
        admin
            .from('branches')
            .select('id,name')
            .eq('biz_id', bizId)
            .eq('is_active', true)
            .order('name'),
    ]);

    // Логируем ошибки для отладки
    if (svcError) {
        console.error('[EditServicePage] Error loading service:', svcError);
        return notFound();
    }

    if (branchesError) {
        console.error('[EditServicePage] Error loading branches:', branchesError);
        // Не возвращаем 404, т.к. это не критично
    }

    // Проверяем, найдена ли услуга
    if (!svc) {
        console.error('[EditServicePage] Service not found:', id);
        return notFound();
    }

    // Проверяем, принадлежит ли услуга текущему бизнесу
    if (String(svc.biz_id) !== String(bizId)) {
        console.error('[EditServicePage] Service belongs to different business:', {
            serviceBizId: svc.biz_id,
            currentBizId: bizId,
            serviceId: id,
        });
        return notFound();
    }

    // Находим все активные услуги с таким же названием в этом бизнесе (это "копии" услуги в разных филиалах)
    // Неактивные услуги (мягко удаленные) не должны показываться
    const { data: allServiceBranches } = await admin
        .from('services')
        .select('branch_id')
        .eq('biz_id', bizId)
        .eq('name_ru', svc.name_ru)
        .eq('active', true); // Только активные услуги

    // Получаем список ID филиалов, где есть эта услуга
    const serviceBranchIds = new Set(
        (allServiceBranches ?? []).map((s: { branch_id: string }) => s.branch_id),
    );

    return (
        <EditServicePageClient
            svc={{
                id: String(svc.id),
                name_ru: String(svc.name_ru),
                name_ky: svc.name_ky || null,
                name_en: svc.name_en || null,
                duration_min: Number(svc.duration_min),
                price_from: Number(svc.price_from),
                price_to: Number(svc.price_to),
                active: !!svc.active,
                branch_id: String(svc.branch_id),
            }}
            branches={branches || []}
            serviceBranchIds={Array.from(serviceBranchIds)}
        />
    );
}
