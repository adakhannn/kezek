// apps/web/src/app/staff/finance/page.tsx
import { FinancePage } from './components/FinancePage';

import { getStaffPageContext } from '@/lib/authBiz';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export default async function StaffFinancePage() {
    // Доступ проверяет layout (вход, выбор бизнеса, ошибка); без доступа страница пустая.
    const context = await getStaffPageContext();
    if (!context) return null;
    const { bizId, staffId } = context;

    return <FinancePage showHeader={true} viewScope={`${bizId}:${staffId}`} />;
}


