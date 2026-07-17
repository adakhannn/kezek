import FinancePageClient from './FinancePageClient';

import { getBizContextForManagers } from '@/lib/authBiz';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export default async function AllStaffFinancePage() {
    const { business } = await getBizContextForManagers();

    const bizName = business?.name ?? null;
    const bizCity = business?.city ?? null;

    return <FinancePageClient bizName={bizName} bizCity={bizCity} />;
}

