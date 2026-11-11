import NewStaffPageClient from './NewStaffPageClient';

import { getBizContextForManagers } from '@/lib/authBiz';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export default async function NewStaffPage() {
    let branches: Array<{ id: string; name: string }> = [];
    let errorMessage: string | null = null;
    try {
        const { supabase, bizId } = await getBizContextForManagers();

        const { data } = await supabase
            .from('branches')
            .select('id,name')
            .eq('biz_id', bizId)
            .order('name');

        branches = data ?? [];
    } catch (e: unknown) {
        errorMessage = e instanceof Error ? e.message : 'Нет доступа';
    }
    if (errorMessage !== null) return <main className="p-6 text-red-600">{errorMessage}</main>;
    return <NewStaffPageClient branches={branches} />;
}
