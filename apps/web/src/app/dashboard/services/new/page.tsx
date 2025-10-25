import ServiceForm from '../ServiceForm';

import { getBizContextForManagers } from '@/lib/authBiz';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export default async function NewServicePage() {
    const { supabase, bizId } = await getBizContextForManagers();
    const { data: branches } = await supabase
        .from('branches')
        .select('id,name')
        .eq('biz_id', bizId)
        .eq('is_active', true)
        .order('name');

    const defaultBranch = branches?.[0]?.id ?? '';

    return (
        <main className="mx-auto max-w-3xl p-6 space-y-4">
            <h1 className="text-2xl font-semibold">Новая услуга</h1>
            <ServiceForm
                initial={{
                    name_ru: '',
                    duration_min: 60,
                    price_from: 0,
                    price_to: 0,
                    active: true,
                    branch_id: defaultBranch,
                }}
                branches={branches || []}
                apiBase="/api/services"
            />
        </main>
    );
}
