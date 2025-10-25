import { notFound } from 'next/navigation';

import BranchForm from '../BranchForm';

import { getBizContextForManagers } from '@/lib/authBiz';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export default async function EditBranchPage({ params }: { params: { id: string } }) {
    const { supabase, bizId } = await getBizContextForManagers();

    const { data: branch, error } = await supabase
        .from('branches')
        .select('id,name,address,is_active,biz_id')
        .eq('id', params.id)
        .maybeSingle();

    if (error) {
        return <main className="p-6 text-red-600">Ошибка: {error.message}</main>;
    }
    if (!branch || String(branch.biz_id) !== String(bizId)) return notFound();

    return (
        <main className="mx-auto max-w-3xl p-6 space-y-4">
            <h1 className="text-2xl font-semibold">Редактирование филиала</h1>
            <BranchForm
                initial={{
                    id: String(branch.id),
                    name: String(branch.name),
                    address: (branch.address ?? null),
                    is_active: !!branch.is_active,
                }}
                apiBase="/api/branches"
            />
        </main>
    );
}
