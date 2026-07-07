import BranchForm from '../BranchForm';

import { getT } from '@/app/_components/i18n/server';
import { AlertBanner } from '@/components/ui/AlertBanner';
import { getBizContextForManagers } from '@/lib/authBiz';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export default async function NewBranchPage() {
    // проверка доступа; данные не нужны
    const { supabase, userId, bizId } = await getBizContextForManagers();

    // Проверяем, является ли пользователь суперадмином
    const { data: isSuper } = await supabase.rpc('is_super_admin');
    const isSuperAdmin = !!isSuper;

    const { data: ownedBusiness } = await supabase
        .from('businesses')
        .select('id,branch_limit')
        .eq('id', bizId)
        .eq('owner_id', userId)
        .maybeSingle();
    const canCreateBranch = isSuperAdmin || !!ownedBusiness;

    if (!canCreateBranch) {
        const t = getT('ru');
        return (
            <main className="mx-auto max-w-3xl p-6">
                                <AlertBanner
                    variant="danger"
                    title={t('branches.new.noAccess.title', 'Нет доступа')}
                    message={t('branches.new.noAccess.description', 'Только владелец бизнеса или суперадминистратор может создавать филиалы.')}
                />
            </main>
        );
    }

    const { data: targetBusiness } = ownedBusiness
        ? { data: ownedBusiness }
        : await supabase.from('businesses').select('id,branch_limit').eq('id', bizId).maybeSingle();
    const { count: branchCount } = await supabase
        .from('branches')
        .select('id', { count: 'exact', head: true })
        .eq('biz_id', bizId);
    const branchLimit = targetBusiness?.branch_limit ?? 1;
    if ((branchCount ?? 0) >= branchLimit) {
        return (
            <main className="mx-auto max-w-3xl p-6">
                <AlertBanner
                    variant="warning"
                    title="Лимит филиалов достигнут"
                    message={`Для бизнеса разрешено ${branchLimit} филиалов. Обратитесь к суперадминистратору для увеличения лимита.`}
                />
            </main>
        );
    }

    return (
        <main className="mx-auto max-w-3xl p-6 space-y-4">
            <h1 className="text-2xl font-semibold">Новый филиал</h1>
            <BranchForm
                initial={{ name: '', address: '', is_active: true }}
                apiBase="/api/branches"
                yandexMapsApiKey={process.env.NEXT_PUBLIC_YANDEX_MAPS_API_KEY}
            />
        </main>
    );
}


