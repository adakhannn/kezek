import NewStaffPageClient from './NewStaffPageClient';

import { getT } from '@/app/_components/i18n/server';
import { LoadFailedNotice } from '@/components/LoadFailedNotice';
import { getBizContextForManagers } from '@/lib/authBiz';
import { logError } from '@/lib/log';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export default async function NewStaffPage() {
    let branches: Array<{ id: string; name: string }> = [];
    let errorMessage: string | null = null;
    let loadFailed = false;
    try {
        const { supabase, bizId } = await getBizContextForManagers();

        const { data, error } = await supabase
            .from('branches')
            .select('id,name')
            .eq('biz_id', bizId)
            .order('name');

        // FE-08: a failed read is an error, not "no branches".
        if (error) {
            logError('NewStaffPage', 'Failed to load branches', { bizId, error });
            loadFailed = true;
        }
        branches = data ?? [];
    } catch (e: unknown) {
        const t = await getT();
        errorMessage = e instanceof Error ? e.message : t('staff.new.errors.noAccess', 'Нет доступа');
    }
    if (errorMessage !== null) return <main className="p-6 text-red-600">{errorMessage}</main>;
    if (loadFailed) return <LoadFailedNotice page />;
    return <NewStaffPageClient branches={branches} />;
}
