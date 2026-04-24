/**
 * Единый API endpoint для получения данных смены сотрудника
 * Поддерживает как сотрудников (через getStaffContext), так и менеджеров (через getBizContextForManagers)
 * 
 * Query параметры:
 * - staffId (опционально) - ID сотрудника (для менеджеров)
 * - date (опционально) - дата в формате YYYY-MM-DD (по умолчанию сегодня)
 */

import { withErrorHandler } from '@/lib/apiErrorHandler';
import { runStaffFinanceHttp } from '@/lib/staffFinanceHttpService';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(req: Request) {
    return withErrorHandler('StaffFinance', async () => runStaffFinanceHttp(req));
}

