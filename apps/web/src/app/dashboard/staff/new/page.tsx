import NewStaffPageClient from './NewStaffPageClient';

import { getBizContextForManagers } from '@/lib/authBiz';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export default async function NewStaffPage() {
    try {
        const { supabase, bizId } = await getBizContextForManagers();

        const { data: branches } = await supabase
            .from('branches')
            .select('id,name')
            .eq('biz_id', bizId)
            .order('name');

        return <NewStaffPageClient branches={branches || []} />;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (e: any) {
        return (
            <main className="p-6 text-red-600">
                {e?.message || 'Нет доступа'}
            </main>
        );
    }
}
