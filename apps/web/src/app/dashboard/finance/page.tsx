import FinancePageClient from './FinancePageClient';

import { getBizContextForManagers } from '@/lib/authBiz';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export default async function AllStaffFinancePage() {
    await getBizContextForManagers();

    return <FinancePageClient />;
}

