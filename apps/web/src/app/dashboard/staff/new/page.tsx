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
    } catch (e: unknown) {
        const message = e instanceof Error ? e.message : 'Нет доступа';
        return (
            <main className="p-6 text-red-600">
                {message}
            </main>
        );
    }
}
