import ServicesListClient from '@/app/dashboard/services/ServicesListClient';
import { getBizContextForManagers } from '@/lib/authBiz';
import { t } from '@/app/_components/i18n/LanguageProvider';


export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

type Branch = { id: string; name: string };
type ServiceRow = {
    id: string;
    name_ru: string;
    duration_min: number;
    price_from: number;
    price_to: number;
    active: boolean | null;
    branch_id: string;
};

export default async function ServicesListPage({
                                                   // ВАЖНО: async searchParams — это Promise<...>
                                                   searchParams,
                                               }: {
    searchParams?: Promise<{ branch?: string | string[] }>;
}) {
    const { supabase, bizId } = await getBizContextForManagers();

    // Распаковываем searchParams
    const sp = (searchParams ? await searchParams : undefined) ?? {};
    // Нормализуем branch к строке
    const branchFilter =
        Array.isArray(sp.branch) ? (sp.branch[0] ?? '') : (sp.branch ?? '');

    const [{ data: branches }, { data: services, error }] = await Promise.all([
        supabase
            .from('branches')
            .select('id,name')
            .eq('biz_id', bizId)
            .eq('is_active', true)
            .order('name'),
        supabase
            .from('services')
            .select('id,name_ru,duration_min,price_from,price_to,active,branch_id')
            .eq('biz_id', bizId)
            .order('name_ru'),
    ]);

    if (error) {
        return (
            <main className="p-6 text-red-600">
                {t('dashboard.services.error', 'Ошибка')}: {error.message}
            </main>
        );
    }

    // Группируем услуги по названию (убираем дубли)
    type GroupedService = {
        name_ru: string;
        duration_min: number;
        price_from: number;
        price_to: number;
        active: boolean;
        branch_ids: string[];
        first_id: string; // ID первой услуги для редактирования
    };

    const serviceMap = new Map<string, GroupedService>();
    
    (services ?? []).forEach((s: ServiceRow) => {
        // Применяем фильтр по филиалу
        if (branchFilter && s.branch_id !== branchFilter) return;
        
        // Учитываем только активные услуги при группировке
        // Неактивные услуги (мягко удаленные) не должны показываться в списке филиалов
        if (!s.active) return;
        
        const key = s.name_ru;
        if (!serviceMap.has(key)) {
            serviceMap.set(key, {
                name_ru: s.name_ru,
                duration_min: s.duration_min,
                price_from: s.price_from,
                price_to: s.price_to,
                active: s.active ?? false,
                branch_ids: [s.branch_id],
                first_id: s.id,
            });
        } else {
            const existing = serviceMap.get(key)!;
            if (!existing.branch_ids.includes(s.branch_id)) {
                existing.branch_ids.push(s.branch_id);
            }
            // Обновляем статус: активна, если хотя бы в одном филиале активна
            if (s.active) existing.active = true;
        }
    });

    const list = Array.from(serviceMap.values());

    return (
        <ServicesListClient
            list={list}
            branches={(branches ?? []) as Branch[]}
            branchFilter={branchFilter}
        />
    );
}
