import BranchForm from '../BranchForm';

import { getBizContextForManagers } from '@/lib/authBiz';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export default async function NewBranchPage() {
    // проверка доступа; данные не нужны
    await getBizContextForManagers();

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
