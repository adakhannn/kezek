import BranchForm from '../BranchForm';

import { getT } from '@/app/_components/i18n/server';
import { AlertBanner } from '@/components/ui/AlertBanner';
import { getBizContextForManagers } from '@/lib/authBiz';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export default async function NewBranchPage() {
    const t = await getT();
    // проверка доступа; данные не нужны
    const { supabase, userId, bizId, business } = await getBizContextForManagers();

    // Проверяем, является ли пользователь суперадмином
    const { data: isSuper } = await supabase.rpc('is_super_admin');
    const isSuperAdmin = !!isSuper;

    const isPrimaryOwner = business?.owner_id === userId;
    const canCreateBranch = isSuperAdmin || isPrimaryOwner;

    if (!canCreateBranch) {
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

    const { count: branchCount } = await supabase
        .from('branches')
        .select('id', { count: 'exact', head: true })
        .eq('biz_id', bizId);
    const branchLimit = business?.branch_limit ?? 1;
    if ((branchCount ?? 0) >= branchLimit) {
        return (
            <main className="mx-auto max-w-3xl p-6">
                <AlertBanner
                    variant="warning"
                    title={t('branches.new.limit.title', 'Лимит филиалов достигнут')}
                    message={t('branches.new.limit.description', 'Для бизнеса разрешено до {limit} филиалов. Обратитесь к суперадминистратору для увеличения лимита.').replace('{limit}', String(branchLimit))}
                />
            </main>
        );
    }

    return (
        <main className="mx-auto max-w-3xl p-6 space-y-4">
            <h1 className="text-2xl font-semibold">{t('branches.new.title', 'Новый филиал')}</h1>
            <BranchForm
                initial={{
                    name: '',
                    address: '',
                    is_active: true,
                    contact_phone: '',
                    contact_whatsapp: '',
                    contact_email: '',
                    website_url: '',
                    inherit_business_contacts: true,
                }}
                businessContacts={{
                    contact_phone: business?.contact_phone ?? null,
                    contact_whatsapp: business?.contact_whatsapp ?? null,
                    contact_email: business?.contact_email ?? null,
                    website_url: business?.website_url ?? null,
                }}
                apiBase="/api/branches"
                yandexMapsApiKey={process.env.NEXT_PUBLIC_YANDEX_MAPS_API_KEY}
            />
        </main>
    );
}


