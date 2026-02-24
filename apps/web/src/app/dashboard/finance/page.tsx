import FinancePageClient from './FinancePageClient';

import { getBizContextForManagers } from '@/lib/authBiz';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export default async function AllStaffFinancePage() {
    const { supabase, bizId } = await getBizContextForManagers();

    const { data: biz } = await supabase
        .from('businesses')
        .select('name, city')
        .eq('id', bizId)
        .maybeSingle<{ name: string | null; city: string | null }>();

    const bizName = biz?.name ?? null;
    const bizCity = biz?.city ?? null;

    return <FinancePageClient bizName={bizName} bizCity={bizCity} />;
}

