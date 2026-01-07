import BranchForm from '../BranchForm';

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
        return (
            <main className="mx-auto max-w-3xl p-6">
                <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-red-600 dark:border-red-800 dark:bg-red-900/20 dark:text-red-400">
                    <h1 className="text-xl font-semibold mb-2">Нет доступа</h1>
                    <p>Только суперадмин может создавать филиалы.</p>
                </div>
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
