import BranchForm from '../BranchForm';

import { getT } from '@/app/_components/i18n/server';
import { AlertBanner } from '@/components/ui/AlertBanner';
import { getBizContextForManagers } from '@/lib/authBiz';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export default async function NewBranchPage() {
    // проверка доступа; данные не нужны
    const { supabase } = await getBizContextForManagers();

    // Проверяем, является ли пользователь суперадмином
    const { data: isSuper } = await supabase.rpc('is_super_admin');
    const isSuperAdmin = !!isSuper;

    if (!isSuperAdmin) {
        const t = getT('ru');
        return (
            <main className="mx-auto max-w-3xl p-6">
                                <AlertBanner
                    variant="danger"
                    title={t('branches.new.noAccess.title', 'Нет доступа')}
                    message={t('branches.new.noAccess.description', 'Только суперадмин может создавать филиалы.')}
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
            />
        </main>
    );
}


