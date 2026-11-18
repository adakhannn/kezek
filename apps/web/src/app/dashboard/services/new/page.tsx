// apps/web/src/app/dashboard/services/new/page.tsx  (или твой путь)

import NewServicePageClient from './NewServicePageClient';

import { LoadFailedNotice } from '@/components/LoadFailedNotice';
import { getBizContextForManagers } from '@/lib/authBiz';
import { logError } from '@/lib/log';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export default async function NewServicePage() {
    const { supabase, bizId } = await getBizContextForManagers();

    const { data: branches, error } = await supabase
        .from('branches')
        .select('id,name')
        .eq('biz_id', bizId)
        .eq('is_active', true)
        .order('name');

    // FE-08: a failed read is an error, not "no branches".
    if (error) {
        logError('NewServicePage', 'Failed to load branches', { bizId, error });
        return <LoadFailedNotice page />;
    }

    return (
        <NewServicePageClient branches={branches || []} />
    );
}
