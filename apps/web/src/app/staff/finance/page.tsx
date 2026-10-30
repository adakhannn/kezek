// apps/web/src/app/staff/finance/page.tsx
import { FinancePage } from './components/FinancePage';

import { getStaffContext } from '@/lib/authBiz';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export default async function StaffFinancePage() {
    // Просто проверяем доступ к кабинету сотрудника
    const { bizId, staffId } = await getStaffContext();

    return <FinancePage showHeader={true} viewScope={`${bizId}:${staffId}`} />;
}


