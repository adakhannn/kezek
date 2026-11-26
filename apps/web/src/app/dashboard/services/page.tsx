import ServicesListClient from '@/app/dashboard/services/ServicesListClient';
import { LoadFailedNotice } from '@/components/LoadFailedNotice';
import { getBizContextForManagers } from '@/lib/authBiz';
import { groupServicesForManagement, type ServiceRow } from '@/lib/dashboardCatalogReadService';
import { logError } from '@/lib/log';


export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

type Branch = { id: string; name: string };

export default async function ServicesListPage({
                                                   // ВАЖНО: async searchParams — это Promise<...>
                                                   searchParams,
                                               }: {
    searchParams?: Promise<{ branch?: string | string[] }>;
}) {
    const { supabase, bizId, business } = await getBizContextForManagers();

    // Распаковываем searchParams
    const sp = (searchParams ? await searchParams : undefined) ?? {};
    // Нормализуем branch к строке
    const branchFilter =
        Array.isArray(sp.branch) ? (sp.branch[0] ?? '') : (sp.branch ?? '');

    const [{ data: branches, error: branchesError }, { data: services, error }] = await Promise.all([
        supabase
            .from('branches')
            .select('id,name')
            .eq('biz_id', bizId)
            .eq('is_active', true)
            .order('name'),
        supabase
            .from('services')
            .select('id,name_ru,name_ky,name_en,duration_min,price_from,price_to,active,branch_id')
            .eq('biz_id', bizId)
            .order('name_ru'),
    ]);

    // FE-08: an empty branch filter after a failed read would hide the business's branches.
    if (branchesError) {
        logError('ServicesPage', 'Failed to load branches', { bizId, error: branchesError });
        return <LoadFailedNotice page />;
    }

    if (error) {
        logError('DashboardServicesPage', 'Failed to load services', { error });
        return <LoadFailedNotice page />;
    }

    // One grouping for this page and GET /api/dashboard/services (the mobile app).
    const list = groupServicesForManagement((services ?? []) as ServiceRow[], branchFilter);

    const bizName = business?.name ?? null;
    const bizCity = business?.city ?? null;

    return (
        <ServicesListClient
            list={list}
            branches={(branches ?? []) as Branch[]}
            branchFilter={branchFilter}
            bizName={bizName}
            bizCity={bizCity}
        />
    );
}
